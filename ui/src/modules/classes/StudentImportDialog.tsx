import { useMutation } from "@apollo/client";
import { useEffect, useMemo, useState } from "react";
import { Button, Dialog, Label, Textarea, toast } from "erxes-ui";
import { CLASS_DETAIL, CLASS_LIST, STUDENT_LIST, STUDENTS_IMPORT } from "../../graphql/classes";
import type { EdureportStudentsImportMutation } from "../../gql/graphql";
import { CLASS_LIST_VARIABLES } from "../useCurrentClass";

// One API call takes at most 200 rows (docs/SPEC.md §5).
const MAX_ROWS = 200;

type Result = EdureportStudentsImportMutation["edureportStudentsImport"];

// Pasted Excel/CSV lines → rows. Each non-blank line is "name<TAB>code"
// (comma or semicolon also split). The API validates every row and reports
// the bad ones; `lines` maps them back to the pasted line numbers.
const parse = (text: string) => {
  const rows: { name: string; code: string }[] = [];
  const lines: number[] = [];

  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) {
      return;
    }

    const [name = "", code = ""] = line.split(/\t|;|,/).map((cell) => cell.trim());

    rows.push({ name, code });
    lines.push(index + 1);
  });

  return { rows, lines };
};

export const StudentImportDialog = ({
  classId,
  open,
  onOpenChange,
}: {
  classId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ value: Result; lines: number[] } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const { rows, lines } = useMemo(() => parse(text), [text]);

  useEffect(() => {
    if (open) {
      setText("");
      setResult(null);
      setProblem(null);
    }
  }, [open]);

  const [importStudents, { loading }] = useMutation(STUDENTS_IMPORT, {
    refetchQueries: [
      { query: STUDENT_LIST, variables: { classId } },
      { query: CLASS_DETAIL, variables: { _id: classId } },
      { query: CLASS_LIST, variables: CLASS_LIST_VARIABLES },
    ],
    awaitRefetchQueries: true,
  });

  const submit = async () => {
    setProblem(null);

    if (rows.length > MAX_ROWS) {
      setProblem(`Нэг удаад ${MAX_ROWS}-аас ихгүй мөр оруулна`);

      return;
    }

    try {
      const { data } = await importStudents({ variables: { classId, rows } });

      if (data) {
        const value = data.edureportStudentsImport;

        setResult({ value, lines });
        setText("");
        toast({ title: `${value.inserted} сурагч нэмэгдлээ`, variant: value.errors.length ? "warning" : "success" });
      }
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="edureport:sm:max-w-xl">
        <Dialog.Header>
          <Dialog.Title>Сурагч импортлох</Dialog.Title>
          <Dialog.Description>
            Excel эсвэл CSV-ээс «Нэр» ба «Код» хоёр баганыг хуулж буулгана. Мөр бүр нэг сурагч.
          </Dialog.Description>
        </Dialog.Header>
        <div className="edureport:flex edureport:flex-col edureport:gap-1.5">
          <Label htmlFor="student-import">Нэр, код</Label>
          <Textarea
            id="student-import"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={10}
            placeholder={"Б. Номин\tS-001\nД. Тэмүүжин\tS-002"}
            className="edureport:font-mono edureport:text-sm"
          />
          <span className="edureport:text-xs edureport:text-muted-foreground">
            {rows.length} мөр · код давхардвал алгасна
          </span>
        </div>
        {problem && <p className="edureport:text-sm edureport:text-destructive">{problem}</p>}
        {result && (
          <div className="edureport:flex edureport:flex-col edureport:gap-2 edureport:rounded-md edureport:border edureport:border-border edureport:bg-muted edureport:p-3 edureport:text-sm">
            <span className="edureport:font-medium">{result.value.inserted} сурагч нэмэгдлээ</span>
            {result.value.skippedCodes.length > 0 && (
              <span className="edureport:text-muted-foreground">
                Аль хэдийн бүртгэлтэй код: {result.value.skippedCodes.join(", ")}
              </span>
            )}
            {result.value.errors.length > 0 && (
              <ul className="edureport:flex edureport:flex-col edureport:gap-1 edureport:text-destructive">
                {result.value.errors.map(({ row, message }) => (
                  <li key={row}>
                    {result.lines[row - 1] ?? row}-р мөр: {message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <Dialog.Footer>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Хаах
          </Button>
          <Button onClick={submit} disabled={loading || !rows.length}>
            {loading ? "Оруулж байна…" : `${rows.length} мөр оруулах`}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
};
