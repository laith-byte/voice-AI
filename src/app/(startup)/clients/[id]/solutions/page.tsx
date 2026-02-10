"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Puzzle, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Solution } from "@/types/database";

interface AssignedSolution extends Solution {
  assigned_at: string;
  client_solution_id: string;
}

export default function SolutionsPage() {
  const params = useParams();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedSolutionId, setSelectedSolutionId] = useState("");
  const [assignedSolutions, setAssignedSolutions] = useState<AssignedSolution[]>([]);
  const [availableSolutions, setAvailableSolutions] = useState<Solution[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);

  const clientId = params.id as string;

  const fetchAssignedSolutions = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("client_solutions")
      .select("client_id, solution_id, solutions(*)")
      .eq("client_id", clientId);

    if (error) {
      console.error("Error fetching assigned solutions:", error);
      return [];
    }

    const mapped: AssignedSolution[] = (data ?? [])
      .filter((row: any) => row.solutions)
      .map((row: any) => ({
        ...row.solutions,
        assigned_at: row.solutions?.created_at ?? "",
        client_solution_id: row.solution_id,
      }));

    setAssignedSolutions(mapped);
    return mapped;
  }, [clientId]);

  const fetchAvailableSolutions = useCallback(
    async (currentAssigned: AssignedSolution[]) => {
      const supabase = createClient();

      // First get the client to find the organization_id
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("organization_id")
        .eq("id", clientId)
        .single();

      if (clientError || !clientData) {
        console.error("Error fetching client:", clientError);
        return;
      }

      const assignedIds = currentAssigned.map((s) => s.id);

      let query = supabase
        .from("solutions")
        .select("*")
        .eq("organization_id", clientData.organization_id);

      if (assignedIds.length > 0) {
        query = query.not("id", "in", `(${assignedIds.join(",")})`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching available solutions:", error);
        return;
      }

      setAvailableSolutions(data ?? []);
    },
    [clientId]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    const assigned = await fetchAssignedSolutions();
    await fetchAvailableSolutions(assigned || []);
    setLoading(false);
  }, [fetchAssignedSolutions, fetchAvailableSolutions]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddSolution = async () => {
    if (!selectedSolutionId) return;
    setMutating(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("client_solutions")
      .insert({ client_id: clientId, solution_id: selectedSolutionId });

    if (error) {
      console.error("Error adding solution:", error);
    } else {
      await fetchData();
    }

    setMutating(false);
    setAddDialogOpen(false);
    setSelectedSolutionId("");
  };

  const handleRemoveSolution = async (solutionId: string) => {
    setMutating(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("client_solutions")
      .delete()
      .eq("client_id", clientId)
      .eq("solution_id", solutionId);

    if (error) {
      console.error("Error removing solution:", error);
    } else {
      await fetchData();
    }

    setMutating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-[#6b7280]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Assigned Solutions</CardTitle>
              <p className="text-sm text-[#6b7280] mt-1">
                Automations and integrations enabled for this client
              </p>
            </div>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Solution
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Solution</DialogTitle>
                  <DialogDescription>
                    Assign an available solution to this client. Only unassigned
                    solutions are shown.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="solution-select">Solution</Label>
                    <Select
                      value={selectedSolutionId}
                      onValueChange={setSelectedSolutionId}
                    >
                      <SelectTrigger id="solution-select">
                        <SelectValue placeholder="Select a solution" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSolutions.map((solution) => (
                          <SelectItem key={solution.id} value={solution.id}>
                            <div className="flex flex-col">
                              <span>{solution.name}</span>
                              {solution.description && (
                                <span className="text-xs text-[#6b7280]">
                                  {solution.description}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setAddDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
                    onClick={handleAddSolution}
                    disabled={!selectedSolutionId || mutating}
                  >
                    {mutating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Solution"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {assignedSolutions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Solution</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead className="text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignedSolutions.map((solution) => (
                  <TableRow key={solution.id}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                          <Puzzle className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="font-medium text-[#111827]">
                          {solution.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[#6b7280] max-w-[200px] truncate">
                      {solution.description || "No description"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          solution.is_active
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-gray-50 text-gray-600 border-gray-200"
                        }
                      >
                        {solution.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[#6b7280]">
                      {new Date(solution.assigned_at).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-2">
                        {solution.webhook_url && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-[#6b7280] hover:text-[#111827]"
                            asChild
                          >
                            <a
                              href={solution.webhook_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleRemoveSolution(solution.id)}
                          disabled={mutating}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center px-6">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Puzzle className="w-6 h-6 text-[#6b7280]" />
              </div>
              <h3 className="text-base font-medium text-[#111827] mb-1">
                No solutions assigned
              </h3>
              <p className="text-sm text-[#6b7280] max-w-sm">
                Assign solutions to this client to enable automations and
                integrations for their agents.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
