import type { Schema } from "mongoose";
import { assignmentSchema } from "../modules/edureport/db/definitions/assignments.ts";
import { attendanceSchema } from "../modules/edureport/db/definitions/attendances.ts";
import { classSchema } from "../modules/edureport/db/definitions/classes.ts";
import { reportSchema } from "../modules/edureport/db/definitions/reports.ts";
import { rubricSchema } from "../modules/edureport/db/definitions/rubrics.ts";
import { studentSchema } from "../modules/edureport/db/definitions/students.ts";
import { submissionSchema } from "../modules/edureport/db/definitions/submissions.ts";

// docs/SPEC.md §3, without a database.
const schemas: [string, Schema][] = [
  ["edureport_classes", classSchema],
  ["edureport_students", studentSchema],
  ["edureport_attendances", attendanceSchema],
  ["edureport_rubrics", rubricSchema],
  ["edureport_assignments", assignmentSchema],
  ["edureport_submissions", submissionSchema],
  ["edureport_reports", reportSchema],
];

const uniqueKeys = (schema: Schema) =>
  schema
    .indexes()
    .filter(([, options]) => options?.unique)
    .map(([fields]) => Object.keys(fields));

const enumOf = (schema: Schema, path: string) =>
  (schema.path(path) as unknown as { enumValues: string[] }).enumValues;

describe("schemas", () => {
  it.each(schemas)("%s: collection name, timestamps and a random string _id", (collection, schema) => {
    expect(schema.get("collection")).toBe(collection);
    expect(schema.get("timestamps")).toBe(true);
    expect(schema.path("_id").instance).toBe("String");
    expect(typeof schema.path("_id").options.default).toBe("function");
  });

  it("has the SPEC unique keys", () => {
    expect(uniqueKeys(studentSchema)).toEqual([["classId", "code"]]);
    expect(uniqueKeys(attendanceSchema)).toEqual([["classId", "studentId", "date"]]);
    expect(uniqueKeys(submissionSchema)).toEqual([["assignmentId", "studentId"]]);
    expect(uniqueKeys(classSchema)).toEqual([]);
  });

  it("indexes the lookups by owner, class and status", () => {
    const keys = (schema: Schema) => schema.indexes().map(([fields]) => Object.keys(fields));

    expect(keys(classSchema)).toContainEqual(["teacherId"]);
    expect(keys(rubricSchema)).toContainEqual(["teacherId"]);
    expect(keys(assignmentSchema)).toContainEqual(["classId"]);
    expect(keys(submissionSchema)).toContainEqual(["assignmentId", "status"]);
    expect(keys(reportSchema)).toContainEqual(["classId"]);
  });

  it("stores only the SPEC enum values", () => {
    expect(enumOf(attendanceSchema, "status")).toEqual(["present", "absent", "late", "excused"]);
    expect(enumOf(assignmentSchema, "kind")).toEqual(["task", "essay"]);
    expect(enumOf(submissionSchema, "status")).toEqual([
      "submitted",
      "queued",
      "aiDrafted",
      "failed",
      "approved",
    ]);
    expect(enumOf(reportSchema, "status")).toEqual([
      "draft",
      "generating",
      "ready",
      "failed",
      "approved",
    ]);
  });

  it("has no score field anywhere but the submission", () => {
    const withScore = schemas
      .filter(([, schema]) => schema.path("score"))
      .map(([collection]) => collection);

    expect(withScore).toEqual(["edureport_submissions"]);
  });
});
