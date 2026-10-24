import { ExpectedError } from "erxes-api-shared/utils";
import type { IContext, IModels } from "../../../connectionResolvers.ts";
import type {
  IAssignmentDocument,
  IClassDocument,
  IRubricDocument,
  ISubmissionDocument,
} from "../@types/index.ts";

// Class access by owner/classesViewAll: docs/SPEC.md §4.

type AccessContext = Pick<IContext, "user" | "checkPermission">;

const isForbidden = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "FORBIDDEN";

// checkPermission only allows or throws, so a FORBIDDEN rejection here means
// "own classes only". Anything else (login, transport) still propagates.
export const canViewAllClasses = async ({ user, checkPermission }: AccessContext) => {
  if (user.isOwner) {
    return true;
  }

  try {
    await checkPermission("classesViewAll");

    return true;
  } catch (error) {
    if (isForbidden(error)) {
      return false;
    }

    throw error;
  }
};

// Mongo filter limiting classes or rubrics (both carry teacherId) to what the
// user may see.
export const teacherScopeFilter = async (context: AccessContext) =>
  (await canViewAllClasses(context)) ? {} : { teacherId: context.user._id };

// Every id must belong to a student of the class (SPEC §5).
export const assertStudentsInClass = async (
  models: IModels,
  classId: string,
  studentIds: readonly string[],
): Promise<void> => {
  const unique = [...new Set(studentIds)];
  const found = await models.Students.countDocuments({ classId, _id: { $in: unique } });

  if (found !== unique.length) {
    throw new ExpectedError("Сурагч тухайн ангид харьяалагдахгүй байна");
  }
};

const usableClass = async (models: IModels, context: AccessContext, classId: string) => {
  const cls = await models.Classes.findOne({ _id: classId });

  return cls && (cls.teacherId === context.user._id || (await canViewAllClasses(context))) ? cls : null;
};

// Anything the user may not use is reported exactly like a missing record, so
// its existence is not revealed.
export const assertClassAccess = async (
  models: IModels,
  context: AccessContext,
  classId: string,
): Promise<IClassDocument> => {
  const cls = await usableClass(models, context, classId);

  if (!cls) {
    throw new ExpectedError("Анги олдсонгүй");
  }

  return cls;
};

export const assertAssignmentAccess = async (
  models: IModels,
  context: AccessContext,
  assignmentId: string,
): Promise<IAssignmentDocument> => {
  const assignment = await models.Assignments.findOne({ _id: assignmentId });

  if (!assignment || !(await usableClass(models, context, assignment.classId))) {
    throw new ExpectedError("Даалгавар олдсонгүй");
  }

  return assignment;
};

export const assertSubmissionAccess = async (
  models: IModels,
  context: AccessContext,
  submissionId: string,
): Promise<ISubmissionDocument> => {
  const submission = await models.Submissions.findOne({ _id: submissionId });

  if (!submission || !(await usableClass(models, context, submission.classId))) {
    throw new ExpectedError("Илгээсэн ажил олдсонгүй");
  }

  return submission;
};

// A rubric belongs to its teacher: only they save it or attach it to an
// assignment, whatever their class-wide rights (SPEC §4, §5).
export const assertOwnRubric = async (
  models: IModels,
  context: AccessContext,
  rubricId: string,
): Promise<IRubricDocument> => {
  const rubric = await models.Rubrics.findOne({ _id: rubricId });

  if (!rubric || rubric.teacherId !== context.user._id) {
    throw new ExpectedError("Шалгуур олдсонгүй");
  }

  return rubric;
};
