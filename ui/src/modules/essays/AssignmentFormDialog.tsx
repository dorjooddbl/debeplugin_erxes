import { useMutation, useQuery } from "@apollo/client";
import { type FormEvent, useEffect, useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { Button, Dialog, Input, Label, Select, toast } from "erxes-ui";
import { ASSIGNMENT_ADD, ASSIGNMENT_LIST, RUBRIC_LIST } from "../../graphql/essays";
import type { EdureportAssignmentKind } from "../../gql/graphql";
import { RubricFormDialog } from "./RubricFormDialog";

const isKind = (value: string): value is EdureportAssignmentKind => value === "task" || value === "essay";

export const AssignmentFormDialog = ({
  classId,
  open,
  onOpenChange,
  onSaved,
}: {
  classId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (assignmentId: string) => void;
}) => {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<EdureportAssignmentKind>("essay");
  const [maxScore, setMaxScore] = useState("10");
  const [dueDate, setDueDate] = useState("");
  const [rubricId, setRubricId] = useState("");
  const [addingRubric, setAddingRubric] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const rubrics = useQuery(RUBRIC_LIST, { skip: !open });
  const [addAssignment, { loading }] = useMutation(ASSIGNMENT_ADD, {
    refetchQueries: [{ query: ASSIGNMENT_LIST, variables: { classId } }],
    awaitRefetchQueries: true,
  });

  const rubricRows = rubrics.data?.edureportRubricList ?? [];

  useEffect(() => {
    if (open) {
      setTitle("");
      setKind("essay");
      setMaxScore("10");
      setDueDate("");
      setProblem(null);
    }
  }, [open]);

  // Default to the newest rubric once they load.
  useEffect(() => {
    if (!rubricId && rubricRows.length) {
      setRubricId(rubricRows[rubricRows.length - 1]?._id ?? "");
    }
  }, [rubricId, rubricRows]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setProblem(null);

    const score = Number(maxScore);

    if (!title.trim()) {
      setProblem("Даалгаврын нэрийг бөглөнө үү");

      return;
    }

    if (!Number.isFinite(score) || score <= 0) {
      setProblem("Дээд оноо 0-ээс их байна");

      return;
    }

    if (kind === "essay" && !rubricId) {
      setProblem("Эссэ даалгаварт шалгуур сонгоно");

      return;
    }

    try {
      const { data } = await addAssignment({
        variables: {
          classId,
          title: title.trim(),
          kind,
          maxScore: score,
          rubricId: kind === "essay" ? rubricId : null,
          dueDate: dueDate || null,
        },
      });

      toast({ title: "Даалгавар нэмэгдлээ", variant: "success" });
      onOpenChange(false);

      if (data) {
        onSaved?.(data.edureportAssignmentAdd._id);
      }
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <Dialog.Content className="edureport:sm:max-w-lg">
          <form onSubmit={submit} className="edureport:flex edureport:flex-col edureport:gap-4">
            <Dialog.Header>
              <Dialog.Title>Даалгавар нэмэх</Dialog.Title>
              <Dialog.Description>Энгийн даалгаварт оноог шивнэ; эссэд AI ноорог бичнэ, оноог багш тавина.</Dialog.Description>
            </Dialog.Header>
            <div className="edureport:flex edureport:flex-col edureport:gap-1.5">
              <Label htmlFor="assignment-title">Нэр</Label>
              <Input id="assignment-title" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
            </div>
            <div className="edureport:grid edureport:grid-cols-3 edureport:gap-3">
              <div className="edureport:flex edureport:flex-col edureport:gap-1.5">
                <Label>Төрөл</Label>
                <Select value={kind} onValueChange={(value) => isKind(value) && setKind(value)}>
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="essay">Эссэ</Select.Item>
                    <Select.Item value="task">Энгийн даалгавар</Select.Item>
                  </Select.Content>
                </Select>
              </div>
              <div className="edureport:flex edureport:flex-col edureport:gap-1.5">
                <Label htmlFor="assignment-max">Дээд оноо</Label>
                <Input id="assignment-max" inputMode="decimal" value={maxScore} onChange={(event) => setMaxScore(event.target.value)} />
              </div>
              <div className="edureport:flex edureport:flex-col edureport:gap-1.5">
                <Label htmlFor="assignment-due">Хугацаа</Label>
                <Input id="assignment-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </div>
            </div>
            {kind === "essay" && (
              <div className="edureport:flex edureport:flex-col edureport:gap-1.5">
                <Label>Шалгуур</Label>
                <div className="edureport:flex edureport:gap-2">
                  <Select value={rubricId} onValueChange={setRubricId}>
                    <Select.Trigger className="edureport:flex-1">
                      <Select.Value placeholder={rubrics.loading ? "Ачаалж байна…" : "Шалгуур сонгох"} />
                    </Select.Trigger>
                    <Select.Content>
                      {rubricRows.map((rubric) => (
                        <Select.Item key={rubric._id} value={rubric._id}>
                          {rubric.name} · {rubric.criteria.length} шалгуур
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                  <Button type="button" variant="outline" onClick={() => setAddingRubric(true)}>
                    <IconPlus />
                    Шинэ
                  </Button>
                </div>
                {rubrics.error && (
                  <span className="edureport:text-xs edureport:text-destructive">{rubrics.error.message}</span>
                )}
              </div>
            )}
            {problem && <p className="edureport:text-sm edureport:text-destructive">{problem}</p>}
            <Dialog.Footer>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Болих
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Хадгалж байна…" : "Хадгалах"}
              </Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog>
      <RubricFormDialog open={addingRubric} onOpenChange={setAddingRubric} onSaved={setRubricId} />
    </>
  );
};
