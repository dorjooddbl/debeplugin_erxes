import { useMutation } from "@apollo/client";
import { type FormEvent, useEffect, useState } from "react";
import { Button, Dialog, Input, Label, toast } from "erxes-ui";
import { CLASS_DETAIL, CLASS_LIST, STUDENT_LIST, STUDENTS_IMPORT } from "../../graphql/classes";
import { CLASS_LIST_VARIABLES } from "../useCurrentClass";

// One student through the import operation (the API has no single "add").
export const StudentAddDialog = ({
  classId,
  open,
  onOpenChange,
}: {
  classId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setCode("");
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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setProblem(null);

    try {
      const { data } = await importStudents({
        variables: { classId, rows: [{ name: name.trim(), code: code.trim() }] },
      });
      const result = data?.edureportStudentsImport;

      if (!result) {
        return;
      }

      if (result.errors.length) {
        setProblem(result.errors.map(({ message }) => message).join("; "));

        return;
      }

      if (result.skippedCodes.length) {
        setProblem(`${code.trim()} код энэ ангид аль хэдийн бүртгэлтэй`);

        return;
      }

      toast({ title: `${name.trim()} нэмэгдлээ`, variant: "success" });
      onOpenChange(false);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="edureport:sm:max-w-md">
        <form onSubmit={submit} className="edureport:flex edureport:flex-col edureport:gap-4">
          <Dialog.Header>
            <Dialog.Title>Сурагч нэмэх</Dialog.Title>
            <Dialog.Description>AI руу нэр биш, зөвхөн кодыг илгээнэ.</Dialog.Description>
          </Dialog.Header>
          <div className="edureport:flex edureport:flex-col edureport:gap-1.5">
            <Label htmlFor="student-name">Нэр</Label>
            <Input id="student-name" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          </div>
          <div className="edureport:flex edureport:flex-col edureport:gap-1.5">
            <Label htmlFor="student-code">Сурагчийн код</Label>
            <Input
              id="student-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="S-031"
            />
          </div>
          {problem && <p className="edureport:text-sm edureport:text-destructive">{problem}</p>}
          <Dialog.Footer>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Болих
            </Button>
            <Button type="submit" disabled={loading || !name.trim() || !code.trim()}>
              {loading ? "Нэмж байна…" : "Нэмэх"}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog>
  );
};
