
import { GoogleGenAI, Type } from "@google/genai";
import { TokenUsage, GradingResult } from "../types";

/**
 * Processes an image file to prepare it for the Gemini API.
 */
async function fileToGenerativePart(file: File) {
  return new Promise<{ inlineData: { data: string; mimeType: string } }>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_DIMENSION = 4096; 

        if (width > height) {
          if (width > MAX_DIMENSION) {
            height *= MAX_DIMENSION / width;
            width = MAX_DIMENSION;
          }
        } else {
          if (height > MAX_DIMENSION) {
            width *= MAX_DIMENSION / height;
            height = MAX_DIMENSION;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/png'); 
        resolve({
            inlineData: {
                data: dataUrl.split(',')[1],
                mimeType: 'image/png',
            },
        });
      };
      img.onerror = () => reject(new Error("Failed to load image for processing"));
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
  });
}

/**
 * Generates structured standard answers from an image using Gemini 3 Flash.
 */
export async function generateStandardAnswerFromImage(answerKeyFiles: File[]): Promise<{ text: string, usage: TokenUsage | undefined }> {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable is not set.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const imageParts = await Promise.all(answerKeyFiles.map(file => fileToGenerativePart(file)));

    const textPart = {
        text: `
        你是一个专业的试卷数字化助手。你的任务是将一组图片转换为结构化的 Excel 兼容 JSON 数据。
        识别图片中的每一道题，提取其题号、题目题干内容、满分值、最终答案和详细得分步骤。
        题号统一为 "14(1)", "14(2)" 格式。
        提取题目完整题干描述到 'question_content'。
        `
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [textPart, ...imageParts] },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    answers: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                question_number: { type: Type.STRING },
                                question_content: { type: Type.STRING },
                                full_marks: { type: Type.NUMBER },
                                final_result: { type: Type.STRING },
                                grading_points: { type: Type.STRING }
                            },
                            required: ['question_number', 'question_content', 'full_marks', 'final_result', 'grading_points']
                        }
                    }
                },
                required: ['answers']
            }
        }
    });

    return { text: response.text?.trim() || "", usage: response.usageMetadata as TokenUsage | undefined };
}

export const DEFAULT_GRADING_PROMPT = `
你是一位物理教育专家。你必须遵循“物理评分自动框架 (PSAS)”对学生答卷进行深度逻辑批改。

<absolute_score_rule>
1. **完全忽视图片内分数**：学生上传的答卷图片中可能包含手写的数字（如“8分”、“-2”）、圈选的数字或任何评分标记。这些**不是**该题的总分。请把图片中的所有数字仅视为解题过程的一部分，而非分数依据。
2. **唯一分值来源**：每道题的【满分 (full_marks)】必须严格且完全以我提供的【标准答案数据 (Standard Answer Key)】JSON 为准。
3. **分值校验**：在输出每个题目的 'max_score' 时，必须直接引用标准答案 JSON 中对应题号的 'full_marks'。
</absolute_score_rule>

<core_logic_psas>
1. 模型对齐 (Model Mapping)：识别学生使用了哪种物理模型（如动量守恒、动能定理）。如果学生使用了【标准答案】之外的合法替代解法（如几何法 vs 解析法），必须基于物理等效性给分。
2. 首错判定 (First Error Step Detection)：识别解答路径中偏离正确逻辑的第一个节点。
   - 【计算手误】：代数变形错但物理模型对，扣除结果分，后续步骤公式若正确应给予公式分。
   - 【根本性物理错误】：物理原理、定律应用完全错误，则该点及后续所有关联步骤计0分。
3. 代数等效性 (Symbolic Equivalence)：验证学生列出的 LaTeX 方程是否在物理含义上与标准步骤等价。
</core_logic_psas>

<output_constraint>
- 必须为每一个分值点提供【证据引用】。引用学生答案中的具体 LaTeX 片段。
- 每一个评分必须包含置信度 (confidence_score)。
</output_constraint>

【标准答案数据 (Standard Answer Key)】
{{STANDARD_ANSWER_JSON}}

【任务输出格式】
输出纯净的 JSON。
`;

/**
 * Grades student answers using Gemini 3 Pro with Thinking Mode enabled.
 */
export async function gradeStudentAnswers(
  standardAnswerJson: string, 
  studentImageFiles: File[],
  customPrompt?: string
): Promise<{ text: string, usage: TokenUsage | undefined }> {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable is not set.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const promptTemplate = customPrompt || DEFAULT_GRADING_PROMPT;
    const finalPromptText = promptTemplate.replace('{{STANDARD_ANSWER_JSON}}', standardAnswerJson);

    const parts: any[] = [{ text: finalPromptText }];

    for (const file of studentImageFiles) {
        parts.push({ text: `\n>>> 待批改学生图片文件名: "${file.name}"` });
        const imagePart = await fileToGenerativePart(file);
        parts.push(imagePart);
    }

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts },
        config: {
            thinkingConfig: { thinkingBudget: 24576 },
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    results: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                student_identifier: { type: Type.STRING },
                                student_answers: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            question_number: { type: Type.STRING },
                                            score: { type: Type.NUMBER },
                                            max_score: { type: Type.NUMBER, description: "必须从标准答案 JSON 中读取，不得参考图片" },
                                            feedback: { type: Type.STRING },
                                            recognized_answer: { type: Type.STRING },
                                            evidence_quote: { type: Type.STRING },
                                            confidence_score: { type: Type.NUMBER },
                                            is_alternative_solution: { type: Type.BOOLEAN },
                                            needs_human_review: { type: Type.BOOLEAN },
                                            review_reason: { type: Type.STRING }
                                        },
                                        required: ['question_number', 'score', 'max_score', 'feedback', 'recognized_answer', 'evidence_quote', 'confidence_score', 'is_alternative_solution', 'needs_human_review']
                                    }
                                }
                            },
                            required: ['student_identifier', 'student_answers']
                        }
                    }
                },
                required: ['results']
            }
        }
    });

    return { text: response.text?.trim() || "", usage: response.usageMetadata as TokenUsage | undefined };
}

/**
 * Aggregates all grading results into a pedagogical summary.
 */
export async function summarizeGradingResults(results: GradingResult[]): Promise<{ text: string, usage: TokenUsage | undefined }> {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable is not set.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `
你是一位资深物理教学分析专家。下面是一组学生的自动批改结果数据（包含得分、扣分反馈、识别出的公式片段等）。
请根据这些数据进行深度分析，完成以下任务：
1. **班级表现概览**：统计平均分、得分率最高的题目和最低的题目。
2. **高频错误模式**：分析哪些题目学生普遍出错，是因为计算手误、物理模型选取错误、还是受力分析不全？引用具体反馈中的共性描述。
3. **知识盲点识别**：指出学生在哪些特定物理概念（如动量守恒、几何光学等）上存在明显的理解缺口。
4. **教学建议**：针对发现的问题，向老师提供后续复习建议。

数据内容：
${JSON.stringify(results, null, 2)}

请使用结构清晰的 Markdown 格式输出。
`;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            thinkingConfig: { thinkingBudget: 16384 },
        }
    });

    return { text: response.text?.trim() || "", usage: response.usageMetadata as TokenUsage | undefined };
}
