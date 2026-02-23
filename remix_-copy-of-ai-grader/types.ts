
export interface ScorePoint {
  step: string;
  score: number;
}

export interface StructuredAnswer {
  question_number: string;
  full_marks: number;
  answer_text: string;
  points: ScorePoint[];
}

export interface StudentAnswer {
  question_number: string;
  recognized_answer: string;
  score: number;
  max_score: number;
  feedback: string;
  evidence_quote: string;
  confidence_score: number;
  is_alternative_solution: boolean;
  needs_human_review: boolean;
  review_reason: string;
}

export interface GradingResult {
  student_identifier: string;
  total_score: number;
  student_answers: StudentAnswer[];
}

export interface GeneratedStandardAnswer {
    question_number: string; // e.g. "14(1)"
    question_content: string; // The text content of the question itself
    full_marks: number;
    final_result: string; // The specific number or short conclusion
    grading_points: string; // Text description of steps
}

export interface TokenUsage {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}