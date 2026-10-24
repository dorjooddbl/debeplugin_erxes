import { ExpectedError } from "erxes-api-shared/utils";
import type { IContext, IModels } from "../../../connectionResolvers.ts";
import type { IClassDocument } from "../@types/index.ts";

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

// Mongo filter limiting a class query to what the user may see.
export const classScopeFilter = async (context: AccessContext) =>
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

// A class the user may not use is reported exactly like a missing one, so its
// existence is not revealed.
export const assertClassAccess = async (
  models: IModels,
  context: AccessContext,
  classId: string,
): Promise<IClassDocument> => {
  const cls = await models.Classes.findOne({ _id: classId });

  if (!cls || (cls.teacherId !== context.user._id && !(await canViewAllClasses(context)))) {
    throw new ExpectedError("Анги олдсонгүй");
  }

  return cls;
};
