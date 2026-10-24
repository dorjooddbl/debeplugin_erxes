// Feedback and report prompt texts: docs/SPEC.md §7.
import type { IAssignmentDocument, IClassDocument, IReportMetrics, IRubricDocument } from "../@types/index.ts";

// Student code (not name) is used in prompts. No score/grade fields in feedback.
// All responses in Mongolian.

export const feedbackPrompt = (
  assignment: IAssignmentDocument,
  rubric: IRubricDocument,
  essayText: string,
  studentCode: string,
): { system: string; user: string } => {
  const criteriaText = rubric.criteria
    .map(
      (c) =>
        `- ${c.key}: ${c.title}\n  Тайлбар: ${c.description}\n  Түвшнүүд: ${c.levels.join(", ")}`,
    )
    .join("\n");

  const system = `Та Монгол хэлний чадварлаг багш бөгөөд сурагчдын эссэд шүүмжлэлтэй боловч дэмжигч санал хүсэлт өгдөг.
Таны үүрэг бол рубрикт суурилсан тодорхой, бүтээлч санал хүсэлт өгөх явдал юм.

ЧУХАЛ ДҮРМҮҮД:
- Хариултыг Монгол хэлээр бичнэ
- Оноо, дүн, дүнгийн дүрслэл огт дурдахгүй
- Тодорхой, бодит жишээ ашиглана
- Сурагчийн код: ${studentCode}`;

  const user = `Даалгавар: "${assignment.title}"

Рубрик: ${rubric.name}
Шалгуурууд:
${criteriaText}

Сурагчийн эссэ:
---
${essayText}
---

Дээрх рубрикийн ШАЛГУУРын дагуу сурагчийн эссэд МОНГОЛ хэлээр санал хүсэлт өг.
Хариулт нь JSON форматтай байна:
{
  "criteria": [
    {
      "criterionKey": "<шалгуурын түлхүүр>",
      "strengths": ["<эерэг тал 1>", "..."],
      "improvements": ["<сайжруулах зүйл 1>", "..."],
      "evidenceQuote": "<эссэнээс шууд иш татсан хэсэг (заавал биш)>"
    }
  ]
}

АНХААРУУЛГА: JSON дотор оноо, дүн, хувь эсвэл тоон үнэлгээ огт оруулахгүй.`;

  return { system, user };
};

export const reportPrompt = (
  cls: IClassDocument,
  metrics: IReportMetrics,
  from: string,
  to: string,
): { system: string; user: string } => {
  const atRiskCount = metrics.atRiskStudentIds.length;
  const perStudentSummary = metrics.perStudent
    .map((s) => {
      const reasons = s.reasons.length ? s.reasons.join(", ") : "байхгүй";

      return `  - Сурагч ${s.studentId}: ирц=${s.attendanceRate ?? "n/a"}%, дундаж оноо=${s.avgScorePct ?? "n/a"}%, эрсдэлийн шалтгаан: ${reasons}`;
    })
    .join("\n");

  const system = `Та боловсролын мэдээллийн шинжилгээний мэргэжилтэн. Танд ангийн статистик өгөгдлийг үндэслэн Монгол хэлээр товч, ойлгомжтой тайлан бичих үүрэг өгөгдөж байна.

ЧУХАЛ ДҮРМҮҮД:
- Хариултыг МОНГОЛ хэлээр бичнэ
- Зөвхөн өгсөн тоон өгөгдлийг ашиглана
- Дурын шинэ тоо бүү зохио
- Тайлан нь богино, тодорхой байна (5-10 өгүүлбэр)`;

  const user = `Анги: ${cls.name}
Хичээл: ${cls.subject}
Улирал: ${cls.term}
Тайлангийн хугацаа: ${from} - ${to}

СТАТИСТИК ӨГӨГДӨЛ:
- Нийт сурагч: ${metrics.studentCount}
- Нийт хичээлийн цаг: ${metrics.sessions}
- Ангийн дундаж ирц: ${metrics.attendanceRate !== null ? metrics.attendanceRate + "%" : "тооцоогүй"}
- Ангийн дундаж оноо: ${metrics.avgScorePct !== null ? metrics.avgScorePct + "%" : "тооцоогүй"}
- Эрсдэлтэй сурагчдын тоо: ${atRiskCount}

Сурагч тус бүрийн үзүүлэлт:
${perStudentSummary}

Дээрх өгөгдлийг үндэслэн ангийн ерөнхий байдлын талаар Монгол хэлээр товч тайлан бич.
Тайлан нь ангийн дундаж үзүүлэлт, ирцийн байдал, оноо, эрсдэлтэй сурагчдын байдалд дүн шинжилгээ хийнэ.
ЗӨВХӨН өгсөн тоон утгуудыг ашигла.`;

  return { system, user };
};
