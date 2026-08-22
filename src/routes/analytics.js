const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/v1/analytics/student ───────────────────────
// Student/learner dashboard data
router.get('/student', authenticate, async (req, res) => {
  const userId = req.profile.id;
  try {
    const [enrollments, attempts, hours, pathway, gaps, notifications] = await Promise.all([
      supabaseAdmin.from('course_enrollments')
        .select('status, progress_pct, igot_courses(title, thumbnail_url, duration_hours)')
        .eq('user_id', userId),
      supabaseAdmin.from('assessment_attempts')
        .select('score, passed, created_at, assessments(title)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabaseAdmin.from('learning_hours_log')
        .select('hours_spent, activity_type, logged_at')
        .eq('user_id', userId),
      supabaseAdmin.from('learning_pathways')
        .select('title, total_hours, target_completion, pathway_items(id)')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      supabaseAdmin.from('skill_gap_reports')
        .select('overall_gap_score, generated_at, summary')
        .eq('user_id', userId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single(),
      supabaseAdmin.from('notifications')
        .select('*').eq('user_id', userId).eq('is_read', false).limit(5),
    ]);

    const enroll = enrollments.data || [];
    const totalHours = (hours.data || []).reduce((s, h) => s + parseFloat(h.hours_spent || 0), 0);
    const completedCourses = enroll.filter(e => e.status === 'completed').length;
    const inProgressCourses = enroll.filter(e => e.status === 'in_progress').length;
    const avgScore = (attempts.data || []).length > 0
      ? Math.round((attempts.data || []).reduce((s, a) => s + (a.score || 0), 0) / attempts.data.length)
      : 0;

    res.json({
      stats: {
        total_courses_enrolled: enroll.length,
        completed_courses: completedCourses,
        in_progress_courses: inProgressCourses,
        total_learning_hours: Math.round(totalHours * 10) / 10,
        avg_assessment_score: avgScore,
        skill_gap_score: gaps.data?.overall_gap_score || null,
        unread_notifications: notifications.data?.length || 0,
      },
      recent_courses: enroll.slice(0, 5),
      recent_attempts: attempts.data || [],
      latest_pathway: pathway.data,
      latest_gap_report: gaps.data,
      notifications: notifications.data || [],
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch student analytics' });
  }
});

// ── GET /api/v1/analytics/instructor ────────────────────
router.get('/instructor', authenticate, authorize('instructor'), async (req, res) => {
  const userId = req.profile.id;
  try {
    const [assessments, attempts, students] = await Promise.all([
      supabaseAdmin.from('assessments')
        .select('id, title, total_questions, is_published, created_at')
        .eq('created_by', userId),
      supabaseAdmin.from('assessment_attempts')
        .select('score, passed, user_id, assessment_id, assessments!inner(created_by)')
        .eq('assessments.created_by', userId),
      supabaseAdmin.from('users')
        .select('id', { count: 'exact' })
        .eq('role', 'student')
        .eq('organization_id', req.profile.organization_id),
    ]);

    const allAttempts = attempts.data || [];
    const avgScore = allAttempts.length
      ? Math.round(allAttempts.reduce((s, a) => s + (a.score || 0), 0) / allAttempts.length)
      : 0;
    const passRate = allAttempts.length
      ? Math.round((allAttempts.filter(a => a.passed).length / allAttempts.length) * 100)
      : 0;

    // Score distribution
    const distribution = { '0-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 };
    allAttempts.forEach(a => {
      const s = a.score || 0;
      if (s <= 40) distribution['0-40']++;
      else if (s <= 60) distribution['41-60']++;
      else if (s <= 80) distribution['61-80']++;
      else distribution['81-100']++;
    });

    res.json({
      stats: {
        total_assessments: (assessments.data || []).length,
        published_assessments: (assessments.data || []).filter(a => a.is_published).length,
        total_attempts: allAttempts.length,
        avg_score: avgScore,
        pass_rate: passRate,
        total_students: students.count || 0,
      },
      assessments: assessments.data || [],
      score_distribution: distribution,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch instructor analytics' });
  }
});

// ── GET /api/v1/analytics/organization ──────────────────
router.get('/organization', authenticate, authorize('organization_admin'), async (req, res) => {
  const orgId = req.profile.organization_id;
  try {
    const [members, enrollments, gapReports, attempts] = await Promise.all([
      supabaseAdmin.from('users')
        .select('id, role, is_active, created_at')
        .eq('organization_id', orgId),
      supabaseAdmin.from('course_enrollments')
        .select('status, user_id, users!inner(organization_id)')
        .eq('users.organization_id', orgId),
      supabaseAdmin.from('skill_gap_reports')
        .select('overall_gap_score, user_id, users!inner(organization_id)')
        .eq('users.organization_id', orgId),
      supabaseAdmin.from('assessment_attempts')
        .select('score, passed, user_id, users!inner(organization_id)')
        .eq('users.organization_id', orgId),
    ]);

    const allMembers = members.data || [];
    const allEnrollments = enrollments.data || [];
    const allGaps = gapReports.data || [];
    const allAttempts = attempts.data || [];

    const roleBreakdown = allMembers.reduce((acc, m) => {
      acc[m.role] = (acc[m.role] || 0) + 1; return acc;
    }, {});

    const completionRate = allEnrollments.length
      ? Math.round((allEnrollments.filter(e => e.status === 'completed').length / allEnrollments.length) * 100)
      : 0;

    const avgGapScore = allGaps.length
      ? Math.round(allGaps.reduce((s, g) => s + (g.overall_gap_score || 0), 0) / allGaps.length)
      : 0;

    res.json({
      stats: {
        total_members: allMembers.length,
        active_members: allMembers.filter(m => m.is_active).length,
        total_enrollments: allEnrollments.length,
        completion_rate: completionRate,
        avg_gap_score: avgGapScore,
        total_assessments_taken: allAttempts.length,
      },
      role_breakdown: roleBreakdown,
      enrollment_status_breakdown: {
        not_started: allEnrollments.filter(e => e.status === 'not_started').length,
        in_progress: allEnrollments.filter(e => e.status === 'in_progress').length,
        completed: allEnrollments.filter(e => e.status === 'completed').length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch organization analytics' });
  }
});

// ── GET /api/v1/analytics/parent ────────────────────────
router.get('/parent', authenticate, authorize('parent'), async (req, res) => {
  const childIds = req.profile.parent_of || [];
  if (childIds.length === 0) return res.json({ children: [] });

  try {
    const childrenData = await Promise.all(childIds.map(async (childId) => {
      const [profile, enrollments, attempts, gaps] = await Promise.all([
        supabaseAdmin.from('users')
          .select('id, full_name, email, designation, avatar_url, last_login_at')
          .eq('id', childId).single(),
        supabaseAdmin.from('course_enrollments')
          .select('status, progress_pct, igot_courses(title)')
          .eq('user_id', childId).limit(5),
        supabaseAdmin.from('assessment_attempts')
          .select('score, passed, created_at, assessments(title)')
          .eq('user_id', childId)
          .order('created_at', { ascending: false }).limit(5),
        supabaseAdmin.from('skill_gap_reports')
          .select('overall_gap_score, summary, generated_at')
          .eq('user_id', childId)
          .order('generated_at', { ascending: false }).limit(1).single(),
      ]);

      const enroll = enrollments.data || [];
      const att = attempts.data || [];
      return {
        profile: profile.data,
        stats: {
          courses_enrolled: enroll.length,
          courses_completed: enroll.filter(e => e.status === 'completed').length,
          avg_score: att.length ? Math.round(att.reduce((s, a) => s + (a.score || 0), 0) / att.length) : 0,
          skill_gap_score: gaps.data?.overall_gap_score || null,
        },
        recent_courses: enroll.slice(0, 3),
        recent_attempts: att.slice(0, 3),
        latest_gap: gaps.data,
      };
    }));

    res.json({ children: childrenData });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch parent analytics' });
  }
});

// ── GET /api/v1/analytics/developer ─────────────────────
router.get('/developer', authenticate, authorize('developer'), async (req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const [apiLogs, users, orgs, auditLogs] = await Promise.all([
      supabaseAdmin.from('api_usage_logs')
        .select('endpoint, method, status_code, latency_ms, created_at')
        .eq('developer_id', req.profile.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(100),
      supabaseAdmin.from('users').select('id, role, created_at', { count: 'exact' }),
      supabaseAdmin.from('organizations').select('id, name, type', { count: 'exact' }),
      supabaseAdmin.from('audit_logs')
        .select('action, entity, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const logs = apiLogs.data || [];
    const avgLatency = logs.length
      ? Math.round(logs.reduce((s, l) => s + (l.latency_ms || 0), 0) / logs.length)
      : 0;
    const errorRate = logs.length
      ? Math.round((logs.filter(l => l.status_code >= 400).length / logs.length) * 100)
      : 0;

    // Endpoint breakdown
    const endpointStats = logs.reduce((acc, l) => {
      const key = `${l.method} ${l.endpoint}`;
      acc[key] = (acc[key] || 0) + 1; return acc;
    }, {});

    res.json({
      stats: {
        total_api_calls_7d: logs.length,
        avg_latency_ms: avgLatency,
        error_rate_pct: errorRate,
        total_users: users.count || 0,
        total_organizations: orgs.count || 0,
      },
      endpoint_stats: Object.entries(endpointStats)
        .map(([endpoint, calls]) => ({ endpoint, calls }))
        .sort((a, b) => b.calls - a.calls)
        .slice(0, 10),
      recent_api_logs: logs.slice(0, 20),
      recent_audit_logs: auditLogs.data || [],
      users_by_role: (users.data || []).reduce((acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1; return acc;
      }, {}),
      organizations: orgs.data || [],
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch developer analytics' });
  }
});

module.exports = router;
