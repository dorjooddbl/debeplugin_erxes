import type { IMainContext } from "erxes-api-shared/core-types";
import { createGenerateModels } from "erxes-api-shared/utils";
import type { Connection } from "mongoose";
import type {
  IAssignmentDocument,
  IAssignmentModel,
  IAttendanceDocument,
  IAttendanceModel,
  IClassDocument,
  IClassModel,
  IReportDocument,
  IReportModel,
  IRubricDocument,
  IRubricModel,
  IStudentDocument,
  IStudentModel,
  ISubmissionDocument,
  ISubmissionModel,
} from "./modules/edureport/@types/index.ts";
import { loadAssignmentClass } from "./modules/edureport/db/models/Assignments.ts";
import { loadAttendanceClass } from "./modules/edureport/db/models/Attendances.ts";
import { loadClassClass } from "./modules/edureport/db/models/Classes.ts";
import { loadReportClass } from "./modules/edureport/db/models/Reports.ts";
import { loadRubricClass } from "./modules/edureport/db/models/Rubrics.ts";
import { loadStudentClass } from "./modules/edureport/db/models/Students.ts";
import { loadSubmissionClass } from "./modules/edureport/db/models/Submissions.ts";

// Collection models: docs/SPEC.md §3.
export interface IModels {
  Classes: IClassModel;
  Students: IStudentModel;
  Attendances: IAttendanceModel;
  Rubrics: IRubricModel;
  Assignments: IAssignmentModel;
  Submissions: ISubmissionModel;
  Reports: IReportModel;
}

/**
 * GraphQL resolver context: what `apolloServerContext` in main.ts returns.
 * `subdomain` is the tenant, `models` are bound to that tenant's database.
 */
// IMainContext declares `models?: any`, which would absorb the typed IModels
// in a plain intersection — Omit it first so resolvers get real types.
export type IContext = Omit<IMainContext, "models"> & {
  subdomain: string;
  models: IModels;
};

// Model names double as collection names (schema `collection` option);
// mongoose reuses a compiled model per connection, so per-request calls are
// cheap. Tests call this with their own connection.
export const loadClasses = (db: Connection): IModels => {
  const models = {} as IModels;

  models.Classes = db.model<IClassDocument, IClassModel>(
    "edureport_classes",
    loadClassClass(models),
  );
  models.Students = db.model<IStudentDocument, IStudentModel>(
    "edureport_students",
    loadStudentClass(models),
  );
  models.Attendances = db.model<IAttendanceDocument, IAttendanceModel>(
    "edureport_attendances",
    loadAttendanceClass(models),
  );
  models.Rubrics = db.model<IRubricDocument, IRubricModel>(
    "edureport_rubrics",
    loadRubricClass(models),
  );
  models.Assignments = db.model<IAssignmentDocument, IAssignmentModel>(
    "edureport_assignments",
    loadAssignmentClass(models),
  );
  models.Submissions = db.model<ISubmissionDocument, ISubmissionModel>(
    "edureport_submissions",
    loadSubmissionClass(models),
  );
  models.Reports = db.model<IReportDocument, IReportModel>(
    "edureport_reports",
    loadReportClass(models),
  );

  return models;
};

// Every model must come from this factory: createGenerateModels binds the
// connection for the request's tenant (Mongo `useDb` per organization on
// SaaS), so resolvers never touch another tenant's collections.
export const generateModels = createGenerateModels<IModels>(loadClasses);
