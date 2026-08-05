import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Search, Star, Trash2 } from "lucide-react";
import { useRatingsModeration, type ModeratedRating } from "@/hooks/useRatingsModeration";

const PAGE_SIZE = 10;

const Stars = ({ value }: { value: number }) => (
  <span className="flex items-center gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`h-3.5 w-3.5 ${i < value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
      />
    ))}
  </span>
);

export const RatingsModerationPanel = () => {
  const { ratings, archived, loading, working, removeRating } = useRatingsModeration();
  const [tab, setTab] = useState("live");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [target, setTarget] = useState<ModeratedRating | null>(null);
  const [reason, setReason] = useState("");

  const source = tab === "live" ? ratings : archived;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return source;
    return source.filter(
      (r) =>
        (r.rated_username || "").toLowerCase().includes(term) ||
        (r.rater_username || "").toLowerCase().includes(term) ||
        (r.comment || "").toLowerCase().includes(term),
    );
  }, [source, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const confirmRemove = async () => {
    if (!target) return;
    const ok = await removeRating(target.id, reason);
    if (ok) {
      setTarget(null);
      setReason("");
    }
  };

  return (
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Trader ratings</CardTitle>
          <p className="text-sm text-muted-foreground">
            Remove abusive or fraudulent reviews. Reputation recalculates automatically.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search trader or comment"
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v);
            setPage(0);
          }}
        >
          <TabsList>
            <TabsTrigger value="live">Active ({ratings.length})</TabsTrigger>
            <TabsTrigger value="archived">Removed ({archived.length})</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-4">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">No ratings found.</p>
            ) : (
              <div className="rounded-xl border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="py-3">Trader</TableHead>
                      <TableHead className="py-3">Reviewer</TableHead>
                      <TableHead className="py-3">Score</TableHead>
                      <TableHead className="py-3">Comment</TableHead>
                      <TableHead className="py-3">Date</TableHead>
                      {tab === "live" && <TableHead className="py-3 text-right">Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="py-4 font-medium">
                          @{r.rated_username || r.rated_id?.slice(0, 8)}
                        </TableCell>
                        <TableCell className="py-4 text-muted-foreground">
                          @{r.rater_username || r.rater_id?.slice(0, 8)}
                        </TableCell>
                        <TableCell className="py-4">
                          <Stars value={r.rating} />
                        </TableCell>
                        <TableCell className="py-4 max-w-sm">
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {r.comment || "—"}
                          </p>
                          {r.archive_reason && (
                            <Badge variant="outline" className="mt-1 border-0 bg-destructive/10 text-destructive">
                              {r.archive_reason}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-4 text-sm text-muted-foreground">
                          {format(new Date(r.archived_at || r.created_at), "MMM d, yyyy")}
                        </TableCell>
                        {tab === "live" && (
                          <TableCell className="py-4 text-right">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setTarget(r);
                                setReason("");
                              }}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              Remove
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{filtered.length} result(s)</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {safePage + 1} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this rating?</DialogTitle>
            <DialogDescription>
              The review is archived with your reason, @{target?.rated_username}'s reputation is
              recalculated, and the action is written to the audit log.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for removal (required)"
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={working || reason.trim().length < 5}
              onClick={confirmRemove}
            >
              Remove rating
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default RatingsModerationPanel;
