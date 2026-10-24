import { type IModels, generateModels } from "../connectionResolvers.ts";
import type { AttendanceStatus } from "../modules/edureport/@types/index.ts";

// Demo data for one subdomain: docs/PROMPTS.md step 2.
//
//   pnpm run seed [subdomain]       (default subdomain: localhost)
//
// Uses MONGO_URL from the repo .env. Ids are fixed, and each run first removes
// the previous seed (the class with everything under it, and the rubric), so
// running it again yields the same data instead of duplicates. Set
// EDUREPORT_SEED_TEACHER_ID to an erxes user _id to make that user the
// class's teacher; owners see every class either way.

const SUBDOMAIN = process.argv[2] ?? "localhost";
const TEACHER_ID = process.env.EDUREPORT_SEED_TEACHER_ID ?? "edureport-seed-teacher";

const IDS = {
  class: "edureport-seed-class-7b",
  rubric: "edureport-seed-rubric-essay",
  task: "edureport-seed-task-1",
  essay: "edureport-seed-essay-1",
};

const NAMES = [
  "Б. Номин", "Д. Тэмүүжин", "Г. Анужин", "Э. Билгүүн", "Ц. Сарнай",
  "О. Мөнх-Оргил", "Н. Хулан", "С. Эрдэнэбат", "Т. Солонго", "Ж. Тэргэл",
  "П. Ариунзаяа", "Л. Бат-Очир", "М. Энхжин", "Х. Ганзориг", "Ч. Мишээл",
  "Р. Төгөлдөр", "Б. Уянга", "Д. Мандах", "Г. Цэцэгмаа", "Э. Түвшин",
  "Ц. Нандин", "О. Батжаргал", "Н. Гэрэлмаа", "С. Амар", "Т. Оюу",
  "Ж. Хүслэн", "П. Дөлгөөн", "Л. Сүх-Очир", "М. Индра", "Х. Гантулга",
];

// Students who should come out at risk in reports: low attendance, low scores.
const LOW_ATTENDANCE = new Set([4, 17]);
const LOW_SCORES = new Set([9, 17, 26]);

// Deterministic 0..99 per (student, slot), so every run produces the same data.
const roll = (student: number, slot: number) => (student * 37 + slot * 61 + 11) % 100;

// Mondays and Wednesdays over the 8 weeks from 2026-09-07.
const lessonDates = () =>
  Array.from({ length: 8 }, (_week, week) => [0, 2].map((offset) => {
    const date = new Date(Date.UTC(2026, 8, 7 + week * 7 + offset));

    return date.toISOString().slice(0, 10);
  })).flat();

const attendanceStatus = (student: number, lesson: number): AttendanceStatus => {
  if (LOW_ATTENDANCE.has(student) && lesson % 3 !== 0) {
    return "absent";
  }

  const r = roll(student, lesson);

  return r < 84 ? "present" : r < 92 ? "late" : r < 97 ? "absent" : "excused";
};

const taskScore = (student: number) =>
  LOW_SCORES.has(student) ? 2 + (student % 3) : 6 + (roll(student, 99) % 5);

const RUBRIC_CRITERIA = [
  {
    key: "clarity",
    title: "Санааны тодорхой байдал",
    description: "Гол санаа ойлгомжтой, сэдэвтээ үнэнч эсэх",
    levels: ["Тодорхойгүй", "Хэсэгчлэн тодорхой", "Тодорхой", "Маш тодорхой"],
  },
  {
    key: "structure",
    title: "Бүтэц",
    description: "Удиртгал, гол хэсэг, дүгнэлт логик дараалалтай эсэх",
    levels: ["Бүтэцгүй", "Дутуу", "Бүрэн", "Сайн уялдаатай"],
  },
  {
    key: "language",
    title: "Хэл, дүрэм",
    description: "Үг хэллэг, зөв бичгийн дүрэм",
    levels: ["Олон алдаатай", "Цөөн алдаатай", "Бараг алдаагүй", "Алдаагүй"],
  },
];

// Short made-up essays on "Миний дуртай улирал", built from per-season
// sentences so each student gets a different text of varying quality.
const SEASONS = [
  {
    name: "хавар",
    dative: "хаварт",
    accusative: "хаврыг",
    lines: [
      "Хавар цас хайлж, гол горхи урсаж эхэлдэг.",
      "Шувууд буцаж ирж, өдөр уртасдаг.",
      "Хаврын салхи хүчтэй ч агаар цэвэр болдог.",
      "Бид хаврын амралтаар эмээгийндээ очдог.",
    ],
  },
  {
    name: "зун",
    dative: "зунд",
    accusative: "зуныг",
    lines: [
      "Зун тэнгэр цэлмэг, өдөр дулаан байдаг.",
      "Зуны амралтаар бид хөдөө явж, голд сэлдэг.",
      "Ногоон тал, цэцэгс надад их таалагддаг.",
      "Наадмын үеэр морин уралдаан үзэх их сонирхолтой.",
    ],
  },
  {
    name: "намар",
    dative: "намарт",
    accusative: "намрыг",
    lines: [
      "Намар модны навч шарлаж, унадаг.",
      "Хичээл эхэлж, найзуудтайгаа дахин уулздаг.",
      "Намрын тэнгэр өндөр, цэнхэр харагддаг.",
      "Энэ үед ургац хурааж, хүмүүс өвөлдөө бэлтгэдэг.",
    ],
  },
  {
    name: "өвөл",
    dative: "өвөлд",
    accusative: "өвлийг",
    lines: [
      "Өвөл цас орж, бүх зүйл цагаан болдог.",
      "Бид гулгуур гулгаж, цасан хүн хийдэг.",
      "Хүйтэн ч гэр бүлээрээ хамт байх нь дулаахан.",
      "Цагаан сараар хамаатан садангаараа золгодог.",
    ],
  },
];

const essayText = (student: number) => {
  const season = SEASONS[student % SEASONS.length];

  if (!season) {
    throw new Error("no season");
  }

  const start = student % season.lines.length;
  const body = [0, 1, 2].map((i) => season.lines[(start + i) % season.lines.length]);

  // Every fifth essay is short and stops without a conclusion.
  if (student % 5 === 0) {
    return `миний дуртай улирал бол ${season.name}. ${body[0]} энэ улирал их гоё шүү`;
  }

  return [
    student % 2
      ? `Миний хамгийн дуртай улирал бол ${season.name}.`
      : `Би жилийн дөрвөн улирлаас ${season.dative} хамгийн их дуртай.`,
    ...body,
    student % 3
      ? `Тиймээс ${season.name} надад хамгийн их таалагддаг улирал юм.`
      : `Иймд би ${season.accusative} үргэлж тэсэн ядан хүлээдэг.`,
  ].join(" ");
};

const removePreviousSeed = async (models: IModels) => {
  if (await models.Classes.exists({ _id: IDS.class })) {
    await models.Classes.removeClass(IDS.class);
  }

  await models.Rubrics.deleteOne({ _id: IDS.rubric });
};

const seed = async () => {
  const models = await generateModels(SUBDOMAIN);

  await removePreviousSeed(models);

  await models.Classes.create({
    _id: IDS.class,
    name: "7Б",
    subject: "Монгол хэл",
    term: "2026-2027 I улирал",
    grade: "7",
    teacherId: TEACHER_ID,
  });

  const { inserted } = await models.Students.bulkInsertStudents(
    IDS.class,
    NAMES.map((name, i) => ({ name, code: `S-${String(i + 1).padStart(3, "0")}` })),
  );
  const students = await models.Students.listByClass(IDS.class);

  const dates = lessonDates();
  let marks = 0;

  for (const [lesson, date] of dates.entries()) {
    marks += await models.Attendances.bulkMark(
      IDS.class,
      date,
      students.map(({ _id }, i) => ({ studentId: _id, status: attendanceStatus(i, lesson) })),
      TEACHER_ID,
    );
  }

  await models.Assignments.create({
    _id: IDS.task,
    classId: IDS.class,
    title: "Тест 1: Үг зүй",
    kind: "task",
    maxScore: 10,
    dueDate: "2026-09-25",
  });
  const scores = await models.Submissions.setScores(
    IDS.task,
    IDS.class,
    students.map(({ _id }, i) => ({ studentId: _id, score: taskScore(i) })),
    TEACHER_ID,
  );

  await models.Rubrics.create({
    _id: IDS.rubric,
    name: "Эссэ бичлэг",
    teacherId: TEACHER_ID,
    criteria: RUBRIC_CRITERIA,
  });
  await models.Assignments.create({
    _id: IDS.essay,
    classId: IDS.class,
    title: "Эссэ: Миний дуртай улирал",
    kind: "essay",
    maxScore: 10,
    rubricId: IDS.rubric,
    dueDate: "2026-10-16",
  });
  const essays = await models.Submissions.bulkAdd(
    IDS.essay,
    IDS.class,
    students.map(({ _id }, i) => ({ studentId: _id, text: essayText(i) })),
  );

  console.log(
    `Seeded subdomain "${SUBDOMAIN}": class 7Б (${IDS.class}), ${inserted} students, ` +
      `${dates.length} lessons / ${marks} attendance marks (${dates[0]}…${dates.at(-1)}), ` +
      `task with ${scores} scores, rubric with ${RUBRIC_CRITERIA.length} criteria, ${essays} essays submitted.`,
  );
};

// erxes-api-shared keeps Redis and Mongo connections open, so exit explicitly.
seed().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
