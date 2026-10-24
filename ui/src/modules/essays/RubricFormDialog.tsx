import { useMutation } from "@apollo/client";
import { useEffect, useState } from "react";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Button, Dialog, Input, Label, Textarea, toast } from "erxes-ui";
import { RUBRIC_LIST, RUBRIC_SAVE } from "../../graphql/essays";

// SPEC §5: 1–8 criteria with unique keys. Keys are generated; the teacher
// writes the title, what to look for, and the levels.
const MAX_CRITERIA = 8;

type Criterion = { title: string; description: string; levels: string };

const emptyCriterion = (): Criterion => ({ title: "", description: "", levels: "Сул, Дунд, Сайн, Маш сайн" });

const STARTER: Criterion[] = [
  { title: "Санааны тодорхой байдал", description: "Гол санаа ойлгомжтой, сэдэвтээ үнэнч эсэх", levels: "Сул, Дунд, Сайн, Маш сайн" },
  { title: "Бүтэц", description: "Удиртгал, гол хэсэг, дүгнэлт логик дараалалтай эсэх", levels: "Сул, Дунд, Сайн, Маш сайн" },
  { title: "Хэл, дүрэм", description: "Үг хэллэг, зөв бичгийн дүрэм", levels: "Сул, Дунд, Сайн, Маш сайн" },
];

export const RubricFormDialog = ({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (rubricId: string) => void;
}) => {
  const [name, setName] = useState("");
  const [criteria, setCriteria] = useState<Criterion[]>(STARTER);
  const [problem, setProblem] = useState<string | null>(null);
  const [saveRubric, { loading }] = useMutation(RUBRIC_SAVE, {
    refetchQueries: [{ query: RUBRIC_LIST }],
    awaitRefetchQueries: true,
  });

  useEffect(() => {
    if (open) {
      setName("Эссэ бичлэг");
      setCriteria(STARTER);
      setProblem(null);
    }
  }, [open]);

  const update = (index: number, patch: Partial<Criterion>) =>
    setCriteria((current) => current.map((criterion, i) => (i === index ? { ...criterion, ...patch } : criterion)));

  const submit = async () => {
    setProblem(null);

    const filled = criteria.filter(({ title }) => title.trim());

    if (!name.trim() || !filled.length) {
      setProblem("Нэр болон дор хаяж нэг шалгуурыг бөглөнө үү");

      return;
    }

    try {
      const { data } = await saveRubric({
        variables: {
          name: name.trim(),
          criteria: filled.map((criterion, index) => ({
            key: `c${index + 1}`,
            title: criterion.title.trim(),
            description: criterion.description.trim(),
            levels: criterion.levels
              .split(",")
              .map((level) => level.trim())
              .filter(Boolean),
          })),
        },
      });

      toast({ title: "Шалгуур хадгалагдлаа", variant: "success" });
      onOpenChange(false);

      if (data) {
        onSaved?.(data.edureportRubricSave._id);
      }
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="edureport:max-h-[90vh] edureport:overflow-y-auto edureport:sm:max-w-2xl">
        <Dialog.Header>
          <Dialog.Title>Шалгуур (rubric) нэмэх</Dialog.Title>
          <Dialog.Description>
            AI санал хүсэлтийг шалгуур бүрээр бичнэ. Оноог зөвхөн багш тавина.
          </Dialog.Description>
        </Dialog.Header>
        <div className="edureport:flex edureport:flex-col edureport:gap-1.5">
          <Label htmlFor="rubric-name">Нэр</Label>
          <Input id="rubric-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="edureport:flex edureport:flex-col edureport:gap-3">
          {criteria.map((criterion, index) => (
            <div
              key={index}
              className="edureport:flex edureport:flex-col edureport:gap-2 edureport:rounded-md edureport:border edureport:border-border edureport:p-3"
            >
              <div className="edureport:flex edureport:items-center edureport:gap-2">
                <span className="edureport:text-xs edureport:font-semibold edureport:text-muted-foreground">
                  {index + 1}
                </span>
                <Input
                  aria-label={`${index + 1}-р шалгуурын нэр`}
                  value={criterion.title}
                  onChange={(event) => update(index, { title: event.target.value })}
                  placeholder="Шалгуурын нэр"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Шалгуур хасах"
                  disabled={criteria.length <= 1}
                  onClick={() => setCriteria((current) => current.filter((_value, i) => i !== index))}
                >
                  <IconTrash />
                </Button>
              </div>
              <Textarea
                aria-label={`${index + 1}-р шалгуурт юуг харах`}
                value={criterion.description}
                onChange={(event) => update(index, { description: event.target.value })}
                placeholder="Юуг харах вэ"
                rows={2}
              />
              <Input
                aria-label={`${index + 1}-р шалгуурын түвшингүүд`}
                value={criterion.levels}
                onChange={(event) => update(index, { levels: event.target.value })}
                placeholder="Түвшингүүд, таслалаар"
              />
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="edureport:self-start"
            disabled={criteria.length >= MAX_CRITERIA}
            onClick={() => setCriteria((current) => [...current, emptyCriterion()])}
          >
            <IconPlus />
            Шалгуур нэмэх ({criteria.length}/{MAX_CRITERIA})
          </Button>
        </div>
        {problem && <p className="edureport:text-sm edureport:text-destructive">{problem}</p>}
        <Dialog.Footer>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Болих
          </Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? "Хадгалж байна…" : "Хадгалах"}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
};
