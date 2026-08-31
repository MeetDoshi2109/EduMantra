-- ============================================================
-- EduMantra – STEM Education Curriculum Seed Data
-- Focused strictly on:
-- 1. Mathematics
-- 2. Science
-- 3. Computer Science & IT
-- 4. Artificial Intelligence & Robotics
-- ============================================================

-- ============================================================
-- MEDIUMS
-- ============================================================
INSERT INTO mediums (id, name, code, medium_type) VALUES
  ('10000000-0000-0000-0000-000000000001', 'English',  'en', 'english'),
  ('10000000-0000-0000-0000-000000000002', 'Hindi',    'hi', 'hindi'),
  ('10000000-0000-0000-0000-000000000003', 'Gujarati', 'gu', 'gujarati')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- BOARDS
-- ============================================================
INSERT INTO boards (id, name, code, board_type, description) VALUES
  ('20000000-0000-0000-0000-000000000001', 'CBSE',                'cbse',    'cbse',         'Central Board of Secondary Education'),
  ('20000000-0000-0000-0000-000000000002', 'NCERT',               'ncert',   'ncert',         'National Council of Educational Research and Training'),
  ('20000000-0000-0000-0000-000000000003', 'Gujarat State Board', 'gujarat', 'gujarat_state', 'Gujarat Secondary and Higher Secondary Education Board')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- CLASSES (Grades 1–10 for each board)
-- ============================================================
DO $$
DECLARE
  board_ids UUID[] := ARRAY[
    '20000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000003'
  ];
  b UUID;
  g INTEGER;
BEGIN
  FOREACH b IN ARRAY board_ids LOOP
    FOR g IN 1..10 LOOP
      INSERT INTO classes (board_id, grade, name)
      VALUES (b, g, 'Class ' || g)
      ON CONFLICT (board_id, grade) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

-- ============================================================
-- STEM SUBJECTS ONLY
-- ============================================================
-- Deactivate non-STEM subjects if they exist
UPDATE subjects SET is_active = false WHERE code NOT IN ('math', 'science', 'cs_it', 'ai_robotics', 'physics', 'chemistry', 'biology');

-- Insert core STEM subjects for CBSE
INSERT INTO subjects (id, board_id, name, code, description, color_hex, is_active) VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Mathematics',             'math',        'Numbers, Algebra, Geometry, Arithmetic & Data Handling',       '#4F46E5', true),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Science',                 'science',     'Physics, Chemistry, Biology & Natural Phenomena',              '#059669', true),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Computer Science & IT',   'cs_it',       'Coding, Python, Algorithms, Web Tech & Computer Systems',      '#0284C7', true),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'AI & Robotics',           'ai_robotics', 'Artificial Intelligence Basics, Logic & Smart Systems',        '#7C3AED', true)
ON CONFLICT (board_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  color_hex = EXCLUDED.color_hex,
  is_active = true;

-- Insert core STEM subjects for NCERT
INSERT INTO subjects (board_id, name, code, description, color_hex, is_active) VALUES
  ('20000000-0000-0000-0000-000000000002', 'Mathematics',           'math',        'Numbers, Algebra, Geometry, Arithmetic & Data Handling',       '#4F46E5', true),
  ('20000000-0000-0000-0000-000000000002', 'Science',               'science',     'Physics, Chemistry, Biology & Natural Phenomena',              '#059669', true),
  ('20000000-0000-0000-0000-000000000002', 'Computer Science & IT', 'cs_it',       'Coding, Python, Algorithms, Web Tech & Computer Systems',      '#0284C7', true),
  ('20000000-0000-0000-0000-000000000002', 'AI & Robotics',         'ai_robotics', 'Artificial Intelligence Basics, Logic & Smart Systems',        '#7C3AED', true)
ON CONFLICT (board_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  color_hex = EXCLUDED.color_hex,
  is_active = true;

-- Insert core STEM subjects for Gujarat State Board
INSERT INTO subjects (board_id, name, code, description, color_hex, is_active) VALUES
  ('20000000-0000-0000-0000-000000000003', 'Mathematics',           'math',        'Numbers, Algebra, Geometry, Arithmetic & Data Handling',       '#4F46E5', true),
  ('20000000-0000-0000-0000-000000000003', 'Science',               'science',     'Physics, Chemistry, Biology & Natural Phenomena',              '#059669', true),
  ('20000000-0000-0000-0000-000000000003', 'Computer Science & IT', 'cs_it',       'Coding, Python, Algorithms, Web Tech & Computer Systems',      '#0284C7', true),
  ('20000000-0000-0000-0000-000000000003', 'AI & Robotics',         'ai_robotics', 'Artificial Intelligence Basics, Logic & Smart Systems',        '#7C3AED', true)
ON CONFLICT (board_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  color_hex = EXCLUDED.color_hex,
  is_active = true;


-- ============================================================
-- 1. CBSE CLASS 7 — MATHEMATICS (STEM)
-- ============================================================
DO $$
DECLARE
  v_class7_cbse UUID;
  v_math_cbse   UUID;
  v_book        UUID;
  v_ch1 UUID; v_ch2 UUID; v_ch3 UUID; v_ch4 UUID; v_ch5 UUID;
BEGIN
  SELECT id INTO v_class7_cbse FROM classes WHERE board_id = '20000000-0000-0000-0000-000000000001' AND grade = 7;
  SELECT id INTO v_math_cbse FROM subjects WHERE board_id = '20000000-0000-0000-0000-000000000001' AND code = 'math';

  -- Book
  INSERT INTO books (id, board_id, class_id, subject_id, medium_id, title, publisher)
  VALUES (
    '40000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001', v_class7_cbse, v_math_cbse,
    '10000000-0000-0000-0000-000000000001',
    'Mathematics — Class VII', 'NCERT'
  ) ON CONFLICT DO NOTHING;
  v_book := '40000000-0000-0000-0000-000000000001';

  -- Chapter 1: Integers
  INSERT INTO chapters (id, book_id, chapter_number, title, learning_goals, estimated_hours)
  VALUES ('50000000-0000-0000-0001-000000000001', v_book, 1, 'Integers',
    ARRAY['Understand integers on a number line', 'Add and subtract integers', 'Multiply and divide integers', 'Apply integer properties'], 8)
  ON CONFLICT DO NOTHING;
  v_ch1 := '50000000-0000-0000-0001-000000000001';

  INSERT INTO topics (id, chapter_id, title, sequence_order) VALUES
    ('60000000-0001-0000-0001-000000000001', v_ch1, 'Introduction to Integers & Number Line', 1),
    ('60000000-0001-0000-0001-000000000002', v_ch1, 'Properties of Addition and Subtraction', 2),
    ('60000000-0001-0000-0001-000000000003', v_ch1, 'Multiplication of Integers', 3),
    ('60000000-0001-0000-0001-000000000004', v_ch1, 'Division of Integers', 4)
  ON CONFLICT DO NOTHING;

  INSERT INTO concepts (topic_id, title, description, sequence_order) VALUES
    ('60000000-0001-0000-0001-000000000001', 'Integers on a Number Line', 'Representation and ordering of positive and negative integers', 1),
    ('60000000-0001-0000-0001-000000000002', 'Commutative & Associative Properties', 'Rules for addition and subtraction of integers', 1),
    ('60000000-0001-0000-0001-000000000003', 'Multiplication of Integers Rules', 'Rules for product of positive and negative numbers', 1),
    ('60000000-0001-0000-0001-000000000004', 'Division of Integers Rules', 'Rules for quotient of signed numbers', 1)
  ON CONFLICT DO NOTHING;

  -- Chapter 2: Fractions and Decimals
  INSERT INTO chapters (id, book_id, chapter_number, title, learning_goals, estimated_hours)
  VALUES ('50000000-0000-0000-0002-000000000001', v_book, 2, 'Fractions and Decimals',
    ARRAY['Multiplication and division of fractions', 'Decimal operations', 'Reciprocals'], 7)
  ON CONFLICT DO NOTHING;
  v_ch2 := '50000000-0000-0000-0002-000000000001';

  INSERT INTO topics (id, chapter_id, title, sequence_order) VALUES
    ('60000000-0001-0000-0002-000000000001', v_ch2, 'Multiplication of Fractions', 1),
    ('60000000-0001-0000-0002-000000000002', v_ch2, 'Division of Fractions', 2),
    ('60000000-0001-0000-0002-000000000003', v_ch2, 'Decimals Multiplication & Division', 3)
  ON CONFLICT DO NOTHING;

  -- Chapter 3: Simple Equations (Algebra)
  INSERT INTO chapters (id, book_id, chapter_number, title, learning_goals, estimated_hours)
  VALUES ('50000000-0000-0000-0003-000000000001', v_book, 3, 'Simple Equations',
    ARRAY['Setting up equations', 'Solving linear equations in one variable', 'Applications in word problems'], 8)
  ON CONFLICT DO NOTHING;

  -- Chapter 4: Lines and Angles (Geometry)
  INSERT INTO chapters (id, book_id, chapter_number, title, learning_goals, estimated_hours)
  VALUES ('50000000-0000-0000-0004-000000000001', v_book, 4, 'Lines and Angles',
    ARRAY['Complementary and supplementary angles', 'Adjacent angles & linear pair', 'Parallel lines and transversals'], 6)
  ON CONFLICT DO NOTHING;

  -- Chapter 5: The Triangle and Its Properties
  INSERT INTO chapters (id, book_id, chapter_number, title, learning_goals, estimated_hours)
  VALUES ('50000000-0000-0000-0005-000000000001', v_book, 5, 'The Triangle and Its Properties',
    ARRAY['Medians and altitudes', 'Exterior angle property', 'Angle sum property of a triangle', 'Pythagoras property'], 8)
  ON CONFLICT DO NOTHING;

END;
$$;


-- ============================================================
-- 2. CBSE CLASS 7 — SCIENCE (STEM)
-- ============================================================
DO $$
DECLARE
  v_class7_cbse UUID;
  v_science_cbse UUID;
  v_book        UUID;
  v_ch1 UUID; v_ch2 UUID; v_ch3 UUID; v_ch4 UUID; v_ch5 UUID;
BEGIN
  SELECT id INTO v_class7_cbse FROM classes WHERE board_id = '20000000-0000-0000-0000-000000000001' AND grade = 7;
  SELECT id INTO v_science_cbse FROM subjects WHERE board_id = '20000000-0000-0000-0000-000000000001' AND code = 'science';

  -- Book
  INSERT INTO books (id, board_id, class_id, subject_id, medium_id, title, publisher)
  VALUES (
    '40000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001', v_class7_cbse, v_science_cbse,
    '10000000-0000-0000-0000-000000000001',
    'Science — Class VII', 'NCERT'
  ) ON CONFLICT DO NOTHING;
  v_book := '40000000-0000-0000-0000-000000000002';

  -- Chapter 1: Nutrition in Plants
  INSERT INTO chapters (id, book_id, chapter_number, title, learning_goals, estimated_hours)
  VALUES ('50000000-0001-0000-0001-000000000001', v_book, 1, 'Nutrition in Plants',
    ARRAY['Understand autotrophs and heterotrophs', 'Explain photosynthesis mechanism', 'Learn parasitic and insectivorous plants'], 6)
  ON CONFLICT DO NOTHING;
  v_ch1 := '50000000-0001-0000-0001-000000000001';

  INSERT INTO topics (id, chapter_id, title, sequence_order) VALUES
    ('60000000-0002-0000-0001-000000000001', v_ch1, 'Modes of Nutrition in Plants', 1),
    ('60000000-0002-0000-0001-000000000002', v_ch1, 'Photosynthesis — Food Synthesis in Plants', 2),
    ('60000000-0002-0000-0001-000000000003', v_ch1, 'Heterotrophic & Insectivorous Plants', 3)
  ON CONFLICT DO NOTHING;

  INSERT INTO concepts (topic_id, title, description, sequence_order) VALUES
    ('60000000-0002-0000-0001-000000000001', 'Autotrophic Nutrition', 'Ability of green plants to produce glucose using sunlight', 1),
    ('60000000-0002-0000-0001-000000000002', 'Photosynthesis & Chlorophyll', 'Light-driven carbon fixation and oxygen production', 1),
    ('60000000-0002-0000-0001-000000000003', 'Parasitic & Insectivorous Adaptations', 'Specialized nutrition in Cuscuta and Pitcher Plant', 1)
  ON CONFLICT DO NOTHING;

  -- Chapter 2: Heat and Temperature (Physics)
  INSERT INTO chapters (id, book_id, chapter_number, title, learning_goals, estimated_hours)
  VALUES ('50000000-0001-0000-0004-000000000001', v_book, 2, 'Heat and Thermodynamics',
    ARRAY['Understand heat vs temperature', 'Conduction, convection, radiation', 'Clinical and laboratory thermometers'], 7)
  ON CONFLICT DO NOTHING;
  v_ch2 := '50000000-0001-0000-0004-000000000001';

  INSERT INTO topics (id, chapter_id, title, sequence_order) VALUES
    ('60000000-0002-0000-0002-000000000001', v_ch2, 'Measuring Temperature & Scales', 1),
    ('60000000-0002-0000-0002-000000000002', v_ch2, 'Transfer of Heat (Conduction, Convection, Radiation)', 2)
  ON CONFLICT DO NOTHING;

  -- Chapter 3: Acids, Bases and Salts (Chemistry)
  INSERT INTO chapters (id, book_id, chapter_number, title, learning_goals, estimated_hours)
  VALUES ('50000000-0001-0000-0005-000000000001', v_book, 3, 'Acids, Bases and Salts',
    ARRAY['Identify acid and base properties', 'Use litmus and indicators', 'Neutralisation reactions'], 6)
  ON CONFLICT DO NOTHING;

  -- Chapter 4: Motion and Time (Physics)
  INSERT INTO chapters (id, book_id, chapter_number, title, learning_goals, estimated_hours)
  VALUES ('50000000-0001-0000-0013-000000000001', v_book, 4, 'Motion and Time',
    ARRAY['Calculate speed = distance / time', 'Plot distance-time graphs', 'Periodic oscillations of simple pendulum'], 7)
  ON CONFLICT DO NOTHING;

  -- Chapter 5: Electric Current and Its Effects (Physics)
  INSERT INTO chapters (id, book_id, chapter_number, title, learning_goals, estimated_hours)
  VALUES ('50000000-0001-0000-0014-000000000001', v_book, 5, 'Electric Current and Its Effects',
    ARRAY['Circuit diagrams and symbols', 'Heating effect of current & fuses', 'Magnetic effect and electromagnets'], 8)
  ON CONFLICT DO NOTHING;

END;
$$;


-- ============================================================
-- 3. CBSE CLASS 7 — COMPUTER SCIENCE & IT (STEM)
-- ============================================================
DO $$
DECLARE
  v_class7_cbse UUID;
  v_cs_cbse     UUID;
  v_book        UUID;
  v_ch1 UUID; v_ch2 UUID; v_ch3 UUID; v_ch4 UUID;
BEGIN
  SELECT id INTO v_class7_cbse FROM classes WHERE board_id = '20000000-0000-0000-0000-000000000001' AND grade = 7;
  SELECT id INTO v_cs_cbse FROM subjects WHERE board_id = '20000000-0000-0000-0000-000000000001' AND code = 'cs_it';

  -- Book
  INSERT INTO books (id, board_id, class_id, subject_id, medium_id, title, publisher)
  VALUES (
    '40000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001', v_class7_cbse, v_cs_cbse,
    '10000000-0000-0000-0000-000000000001',
    'Computer Science & Coding — Class VII', 'EduMantra STEM'
  ) ON CONFLICT DO NOTHING;
  v_book := '40000000-0000-0000-0000-000000000003';

  -- Chapter 1: Fundamentals of Python Programming
  INSERT INTO chapters (id, book_id, chapter_number, title, learning_goals, estimated_hours)
  VALUES ('50000000-0002-0000-0001-000000000001', v_book, 1, 'Introduction to Python Programming',
    ARRAY['Write basic Python scripts', 'Understand variables, datatypes, and operators', 'Use if-else conditional logic', 'Create loops with while and for'], 10)
  ON CONFLICT DO NOTHING;
  v_ch1 := '50000000-0002-0000-0001-000000000001';

  INSERT INTO topics (id, chapter_id, title, sequence_order) VALUES
    ('60000000-0003-0000-0001-000000000001', v_ch1, 'Variables, Strings & Numbers in Python', 1),
    ('60000000-0003-0000-0001-000000000002', v_ch1, 'Conditional Statements (if, elif, else)', 2),
    ('60000000-0003-0000-0001-000000000003', v_ch1, 'Loops & Iterations in Python', 3)
  ON CONFLICT DO NOTHING;

  INSERT INTO concepts (topic_id, title, description, sequence_order) VALUES
    ('60000000-0003-0000-0001-000000000001', 'Python Data Types', 'Numbers (int, float), Strings, and Boolean values in Python', 1),
    ('60000000-0003-0000-0001-000000000002', 'Decision Making in Code', 'Comparison operators (==, !=, >, <) and branch execution', 1),
    ('60000000-0003-0000-0001-000000000003', 'For & While Loops', 'Repeating blocks of code with range() and conditions', 1)
  ON CONFLICT DO NOTHING;

  -- Chapter 2: Computer Systems & Number Systems
  INSERT INTO chapters (id, book_id, chapter_number, title, learning_goals, estimated_hours)
  VALUES ('50000000-0002-0000-0002-000000000001', v_book, 2, 'Computer Systems & Binary Representation',
    ARRAY['Understand CPU, RAM, and Storage architecture', 'Convert Decimal to Binary and vice-versa', 'Data representation in bytes'], 6)
  ON CONFLICT DO NOTHING;
  v_ch2 := '50000000-0002-0000-0002-000000000001';

  INSERT INTO topics (id, chapter_id, title, sequence_order) VALUES
    ('60000000-0003-0000-0002-000000000001', v_ch2, 'Binary & Hexadecimal Number Systems', 1),
    ('60000000-0003-0000-0002-000000000002', v_ch2, 'Computer Hardware Architecture & Memory', 2)
  ON CONFLICT DO NOTHING;

  -- Chapter 3: Web Tech & HTML5/CSS Basics
  INSERT INTO chapters (id, book_id, chapter_number, title, learning_goals, estimated_hours)
  VALUES ('50000000-0002-0000-0003-000000000001', v_book, 3, 'HTML5 & Web Development',
    ARRAY['Structure web pages with HTML tags', 'Style web elements with CSS', 'Build interactive web pages'], 8)
  ON CONFLICT DO NOTHING;

  -- Chapter 4: Cyber Safety, Ethics & Security
  INSERT INTO chapters (id, book_id, chapter_number, title, learning_goals, estimated_hours)
  VALUES ('50000000-0002-0000-0004-000000000001', v_book, 4, 'Cyber Safety & Digital Ethics',
    ARRAY['Password security and authentication', 'Prevent phishing and malware attacks', 'Responsible digital citizenship'], 5)
  ON CONFLICT DO NOTHING;

END;
$$;


-- ============================================================
-- 4. APPROVED SAMPLE QUESTIONS (MATHEMATICS, SCIENCE, COMPUTER SCIENCE)
-- ============================================================
INSERT INTO question_bank (
  board_id, class_id, subject_id, chapter_id, topic_id,
  question_text, question_type, options, correct_answer, explanation,
  difficulty, validation_status, is_active
) VALUES
  -- Math: Integers
  (
    '20000000-0000-0000-0000-000000000001',
    (SELECT id FROM classes WHERE board_id = '20000000-0000-0000-0000-000000000001' AND grade = 7 LIMIT 1),
    '30000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0001-000000000001',
    '60000000-0001-0000-0001-000000000003',
    'What is the product of (-5) × (-4) × (-2)?',
    'mcq',
    '[{"key":"A","text":"-40"},{"key":"B","text":"40"},{"key":"C","text":"-20"},{"key":"D","text":"20"}]'::jsonb,
    'A',
    '(-5) × (-4) = +20. Then (+20) × (-2) = -40. Three negative signs result in a negative product.',
    'easy', 'approved', true
  ),
  (
    '20000000-0000-0000-0000-000000000001',
    (SELECT id FROM classes WHERE board_id = '20000000-0000-0000-0000-000000000001' AND grade = 7 LIMIT 1),
    '30000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0001-000000000001',
    '60000000-0001-0000-0001-000000000004',
    'Evaluate: (-36) ÷ [(-9) ÷ 3]',
    'mcq',
    '[{"key":"A","text":"12"},{"key":"B","text":"-12"},{"key":"C","text":"4"},{"key":"D","text":"-4"}]'::jsonb,
    'A',
    'Inside brackets: (-9) ÷ 3 = -3. Then (-36) ÷ (-3) = +12.',
    'medium', 'approved', true
  ),

  -- Science: Nutrition in Plants
  (
    '20000000-0000-0000-0000-000000000001',
    (SELECT id FROM classes WHERE board_id = '20000000-0000-0000-0000-000000000001' AND grade = 7 LIMIT 1),
    '30000000-0000-0000-0000-000000000002',
    '50000000-0001-0000-0001-000000000001',
    '60000000-0002-0000-0001-000000000002',
    'Which gas is taken in by green plants from the atmosphere during photosynthesis?',
    'mcq',
    '[{"key":"A","text":"Oxygen"},{"key":"B","text":"Carbon Dioxide"},{"key":"C","text":"Nitrogen"},{"key":"D","text":"Hydrogen"}]'::jsonb,
    'B',
    'Plants take in Carbon Dioxide (CO2) through stomata and release Oxygen (O2) as a byproduct of photosynthesis.',
    'easy', 'approved', true
  ),
  (
    '20000000-0000-0000-0000-000000000001',
    (SELECT id FROM classes WHERE board_id = '20000000-0000-0000-0000-000000000001' AND grade = 7 LIMIT 1),
    '30000000-0000-0000-0000-000000000002',
    '50000000-0001-0000-0001-000000000001',
    '60000000-0002-0000-0001-000000000003',
    'Which of the following is an example of an insectivorous plant?',
    'mcq',
    '[{"key":"A","text":"Cuscuta (Amarbel)"},{"key":"B","text":"Pitcher Plant"},{"key":"C","text":"Mushroom"},{"key":"D","text":"Lichen"}]'::jsonb,
    'B',
    'The Pitcher plant traps insects inside its modified leaf jug to extract nitrogen and minerals.',
    'medium', 'approved', true
  ),

  -- Computer Science: Python Programming
  (
    '20000000-0000-0000-0000-000000000001',
    (SELECT id FROM classes WHERE board_id = '20000000-0000-0000-0000-000000000001' AND grade = 7 LIMIT 1),
    '30000000-0000-0000-0000-000000000003',
    '50000000-0002-0000-0001-000000000001',
    '60000000-0003-0000-0001-000000000001',
    'What will be the output of the Python expression: print(7 // 2)?',
    'mcq',
    '[{"key":"A","text":"3.5"},{"key":"B","text":"3"},{"key":"C","text":"4"},{"key":"D","text":"1"}]'::jsonb,
    'B',
    'The // operator performs floor division in Python, discarding the fractional part and returning 3.',
    'easy', 'approved', true
  ),
  (
    '20000000-0000-0000-0000-000000000001',
    (SELECT id FROM classes WHERE board_id = '20000000-0000-0000-0000-000000000001' AND grade = 7 LIMIT 1),
    '30000000-0000-0000-0000-000000000003',
    '50000000-0002-0000-0002-000000000001',
    '60000000-0003-0000-0002-000000000001',
    'What is the binary equivalent of the decimal number 13?',
    'mcq',
    '[{"key":"A","text":"1101"},{"key":"B","text":"1011"},{"key":"C","text":"1110"},{"key":"D","text":"1001"}]'::jsonb,
    'A',
    '13 in binary: 8 + 4 + 0 + 1 = 1101₂.',
    'medium', 'approved', true
  )
ON CONFLICT DO NOTHING;
