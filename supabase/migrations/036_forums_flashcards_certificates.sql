-- Forums scoped to course / module / lesson + enable flag
ALTER TABLE forums ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id) ON DELETE CASCADE;
ALTER TABLE forums ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE;
ALTER TABLE forums ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true;
ALTER TABLE forums ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS forums_course_id_idx ON forums(course_id);
CREATE INDEX IF NOT EXISTS forums_module_id_idx ON forums(module_id);
CREATE INDEX IF NOT EXISTS forums_lesson_id_idx ON forums(lesson_id);

-- Flashcards
CREATE TABLE IF NOT EXISTS flashcard_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  instructor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS flashcard_decks_course_id_idx ON flashcard_decks(course_id);
CREATE INDEX IF NOT EXISTS flashcards_deck_id_idx ON flashcards(deck_id);

ALTER TABLE flashcard_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS flashcard_decks_select ON flashcard_decks;
CREATE POLICY flashcard_decks_select ON flashcard_decks FOR SELECT USING (true);
DROP POLICY IF EXISTS flashcard_decks_write ON flashcard_decks;
CREATE POLICY flashcard_decks_write ON flashcard_decks FOR ALL USING (auth.uid() = instructor_id);

DROP POLICY IF EXISTS flashcards_select ON flashcards;
CREATE POLICY flashcards_select ON flashcards FOR SELECT USING (true);
DROP POLICY IF EXISTS flashcards_write ON flashcards;
CREATE POLICY flashcards_write ON flashcards FOR ALL USING (
  EXISTS (
    SELECT 1 FROM flashcard_decks d
    WHERE d.id = flashcards.deck_id AND d.instructor_id = auth.uid()
  )
);

-- Certificate design settings on courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS certificate_enabled BOOLEAN DEFAULT true;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS certificate_settings JSONB DEFAULT '{}'::jsonb;
