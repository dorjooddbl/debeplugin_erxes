import { useMutation, useQuery } from "@apollo/client";
import { useEffect, useState } from "react";
import { Badge, Button, Dialog, Textarea, toast } from "erxes-ui";
import { STUDENT_LIST } from "../../graphql/classes";
import { SUBMISSIONS_ADD } from "../../graphql/essays";

// docs/SPEC.md §5: at most 100 items per call, 20 000 characters each.
const MAX_ITEMS = 100;
const MAX_LENGTH = 20_000;

// One text box per student (docs/PLAN.md §5.4 step 3): paste each essay next
// to its author. Re-adding replaces a submitted, failed or drafted essay;
// queued and approved ones stay as they are.
export const SubmissionsAddDialog = ({
  classId,
  assignmentId,
  open,
  onOpenChange,
}: {
  classId: string;
  assignmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const students = useQuery(STUDENT_LIST, { variables: { classId }, skip: !open });
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [addSubmissions, { loading }] = useMutation(SUBMISSIONS_ADD, {
    refetchQueries: ["edureportSubmissionList", "edureportSubmissionDetail"],
    awaitRefetchQueries: true,
  });

  useEffect(() => {
    if (open) {
      setTexts({});
      setProblem(null);
    }
  }, [open]);

  const items = Object.entries(texts)
    .map(([studentId, text]) => ({ studentId, text: text.trim() }))
    .filter(({ text }) => text);
  const tooLong = items.filter(({ text }) => text.length > MAX_LENGTH).length;

  const submit = async () => {
    setProblem(null);

    if (tooLong) {
      setProblem(`Эссэ ${MAX_LENGTH.toLocaleString()} тэмдэгтээс урт байна`);

      return;
    }

    try {
      let count = 0;

      for (let i = 0; i < items.length; i += MAX_ITEMS) {
        const { data } = await addSubmissions({ variables: { assignmentId, items: items.slice(i, i + MAX_ITEMS) } });

        count += data?.edureportSubmissionsAdd ?? 0;
      }

      toast({
        title: `${count} эссэ хадгалагдлаа`,
        description:
          count < items.length ? "AI боловсруулж буй эсвэл батлагдсан эссэ өөрчлөгдөөгүй." : undefined,
        variant: count < items.length ? "warning" : "success",
      });
      onOpenChange(false);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    }
  };

  const rows = students.data?.edureportStudentList ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="edureport:max-h-[90vh] edureport:overflow-y-auto edureport:sm:max-w-2xl">
        <Dialog.Header>
          <Dialog.Title>Эссэ оруулах</Dialog.Title>
          <Dialog.Description>
            Сурагч бүрийн хажууд эссэний текстийг буулгана. Хоосон үлдээсэн сурагч өөрчлөгдөхгүй.
          </Dialog.Description>
        </Dialog.Header>
        {students.error && <p className="edureport:text-sm edureport:text-destructive">{students.error.message}</p>}
        {students.loading && !students.data && <p className="edureport:text-sm edureport:text-muted-foreground">Ачаалж байна…</p>}
        <div className="edureport:flex edureport:flex-col edureport:gap-3">
          {rows.map((student) => (
            <div key={student._id} className="edureport:flex edureport:flex-col edureport:gap-1">
              <span className="edureport:flex edureport:items-center edureport:gap-2 edureport:text-sm edureport:font-medium">
                <Badge variant="secondary" className="edureport:font-mono">
                  {student.code}
                </Badge>
                {student.name}
              </span>
              <Textarea
                aria-label={`${student.name}: эссэ`}
                rows={3}
                value={texts[student._id] ?? ""}
                onChange={(event) => setTexts((current) => ({ ...current, [student._id]: event.target.value }))}
              />
            </div>
          ))}
        </div>
        {problem && <p className="edureport:text-sm edureport:text-destructive">{problem}</p>}
        <Dialog.Footer>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Болих
          </Button>
          <Button onClick={submit} disabled={loading || !items.length}>
            {loading ? "Хадгалж байна…" : `${items.length} эссэ хадгалах`}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
};
