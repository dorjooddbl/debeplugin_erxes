import { useMutation } from "@apollo/client";
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Button, Dialog, Input, Label, toast } from "erxes-ui";
import { CLASS_ADD, CLASS_DETAIL, CLASS_EDIT, CLASS_LIST } from "../graphql/classes";
import { CLASS_LIST_VARIABLES } from "./useCurrentClass";

type EditableClass = {
  _id: string;
  name: string;
  subject: string;
  term: string;
  grade?: string | null;
  atRiskAttendancePct?: number | null;
  atRiskScorePct?: number | null;
};

const toForm = (cls?: EditableClass) => ({
  name: cls?.name ?? "",
  subject: cls?.subject ?? "",
  term: cls?.term ?? "",
  grade: cls?.grade ?? "",
  atRiskAttendancePct: cls?.atRiskAttendancePct?.toString() ?? "",
  atRiskScorePct: cls?.atRiskScorePct?.toString() ?? "",
});

// "" keeps the API default (80 / 60); otherwise 0–100.
const parsePercent = (value: string): number | null | "invalid" => {
  if (!value.trim()) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : "invalid";
};

const Field = ({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) => (
  <div className="edureport:flex edureport:flex-col edureport:gap-1.5">
    <Label htmlFor={id}>{label}</Label>
    {children}
  </div>
);

// Adds a class, or edits one when `cls` is given (then also the at-risk thresholds).
export const ClassFormDialog = ({
  open,
  onOpenChange,
  cls,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cls?: EditableClass;
  onSaved?: (classId: string) => void;
}) => {
  const [form, setForm] = useState(toForm(cls));
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(toForm(cls));
      setProblem(null);
    }
  }, [open, cls]);

  const refetchQueries = [
    { query: CLASS_LIST, variables: CLASS_LIST_VARIABLES },
    ...(cls ? [{ query: CLASS_DETAIL, variables: { _id: cls._id } }] : []),
  ];
  const [addClass, adding] = useMutation(CLASS_ADD, { refetchQueries, awaitRefetchQueries: true });
  const [editClass, editing] = useMutation(CLASS_EDIT, { refetchQueries, awaitRefetchQueries: true });

  const set = (key: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    const name = form.name.trim();
    const subject = form.subject.trim();
    const term = form.term.trim();

    if (!name || !subject || !term) {
      setProblem("Анги, хичээл, улирлыг бөглөнө үү");

      return;
    }

    const grade = form.grade.trim() || null;

    try {
      if (!cls) {
        const { data } = await addClass({ variables: { name, subject, term, grade } });

        toast({ title: `${name} анги нэмэгдлээ`, variant: "success" });
        onOpenChange(false);

        if (data) {
          onSaved?.(data.edureportClassAdd._id);
        }

        return;
      }

      const atRiskAttendancePct = parsePercent(form.atRiskAttendancePct);
      const atRiskScorePct = parsePercent(form.atRiskScorePct);

      if (atRiskAttendancePct === "invalid" || atRiskScorePct === "invalid") {
        setProblem("Босго 0-ээс 100 хооронд байна");

        return;
      }

      await editClass({
        variables: { _id: cls._id, name, subject, term, grade, atRiskAttendancePct, atRiskScorePct },
      });

      toast({ title: "Ангийн мэдээлэл хадгалагдлаа", variant: "success" });
      onOpenChange(false);
      onSaved?.(cls._id);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    }
  };

  const saving = adding.loading || editing.loading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="edureport:sm:max-w-lg">
        <form onSubmit={submit} className="edureport:flex edureport:flex-col edureport:gap-4">
          <Dialog.Header>
            <Dialog.Title>{cls ? "Анги засах" : "Анги нэмэх"}</Dialog.Title>
            <Dialog.Description>
              {cls ? "Ангийн мэдээлэл болон анхаарах босгыг засна." : "Шинэ анги үүсгээд сурагчдаа оруулна."}
            </Dialog.Description>
          </Dialog.Header>
          <div className="edureport:grid edureport:grid-cols-2 edureport:gap-3">
            <Field id="class-name" label="Анги">
              <Input id="class-name" value={form.name} onChange={set("name")} placeholder="7Б" autoFocus />
            </Field>
            <Field id="class-grade" label="Түвшин">
              <Input id="class-grade" value={form.grade} onChange={set("grade")} placeholder="7" />
            </Field>
            <Field id="class-subject" label="Хичээл">
              <Input id="class-subject" value={form.subject} onChange={set("subject")} placeholder="Монгол хэл" />
            </Field>
            <Field id="class-term" label="Улирал">
              <Input id="class-term" value={form.term} onChange={set("term")} placeholder="2026-2027 I улирал" />
            </Field>
            {cls && (
              <>
                <Field id="class-risk-attendance" label="Ирцийн босго (%)">
                  <Input
                    id="class-risk-attendance"
                    inputMode="decimal"
                    value={form.atRiskAttendancePct}
                    onChange={set("atRiskAttendancePct")}
                    placeholder="80"
                  />
                </Field>
                <Field id="class-risk-score" label="Онооны босго (%)">
                  <Input
                    id="class-risk-score"
                    inputMode="decimal"
                    value={form.atRiskScorePct}
                    onChange={set("atRiskScorePct")}
                    placeholder="60"
                  />
                </Field>
              </>
            )}
          </div>
          {problem && <p className="edureport:text-sm edureport:text-destructive">{problem}</p>}
          <Dialog.Footer>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Болих
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Хадгалж байна…" : "Хадгалах"}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog>
  );
};
