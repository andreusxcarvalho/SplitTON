import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CaptureBar } from "@/components/CaptureBar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ReceiptParseResult } from "@shared/schema";

const CATEGORIES = [
  "Food & Drinks",
  "Transport",
  "Entertainment",
  "Shopping",
  "Bills",
  "Other",
];

export default function AddExpense() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [total, setTotal] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Food & Drinks");
  const [payer, setPayer] = useState("@me");
  const [participants, setParticipants] = useState<string[]>(["@me"]);
  const [newParticipant, setNewParticipant] = useState("");
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);

  const handlePhotoCapture = async (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadedImage(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Parse receipt with AI
    setIsParsing(true);
    try {
      const formData = new FormData();
      formData.append("receipt", file);

      const result = await apiRequest("POST", "/api/parse-receipt", formData) as unknown as ReceiptParseResult;

      if (result.total) {
        setTotal(result.total.toFixed(2));
      }
      if (result.suggestedCategory) {
        setCategory(result.suggestedCategory);
      }
      setAiConfidence(result.confidence);

      toast({
        title: "Receipt parsed!",
        description: `AI detected ${result.confidence}% confidence`,
      });
    } catch (error) {
      toast({
        title: "Parsing failed",
        description: "You can still enter details manually",
        variant: "destructive",
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleTextInput = () => {
    toast({
      title: "Manual entry",
      description: "Fill in the details below",
    });
  };

  const addParticipant = () => {
    if (newParticipant && !participants.includes(newParticipant)) {
      setParticipants([...participants, newParticipant]);
      setNewParticipant("");
    }
  };

  const removeParticipant = (p: string) => {
    if (p !== payer) {
      setParticipants(participants.filter((participant) => participant !== p));
    }
  };

  const handleSubmit = async () => {
    if (!total || parseFloat(total) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid total amount",
        variant: "destructive",
      });
      return;
    }

    if (participants.length === 0) {
      toast({
        title: "No participants",
        description: "Add at least one participant",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/expenses", {
        total: parseFloat(total),
        description: description || category,
        category,
        payer,
        participants,
        imageUrl: uploadedImage,
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/splits"] });

      toast({
        title: "Expense added!",
        description: "Your expense has been recorded",
      });

      setLocation("/summary");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add expense",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Add Expense</h1>
          <p className="text-muted-foreground">Upload a receipt or enter manually</p>
        </div>

        {/* Image Preview */}
        {uploadedImage && (
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <img
                  src={uploadedImage}
                  alt="Receipt"
                  className="w-full rounded-lg"
                  data-testid="img-receipt-preview"
                />
                {isParsing && (
                  <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
                    <div className="text-center text-white">
                      <Loader2 className="h-12 w-12 animate-spin mx-auto mb-2" />
                      <p className="font-semibold">Parsing receipt...</p>
                    </div>
                  </div>
                )}
                {aiConfidence !== null && (
                  <Badge className="absolute top-2 right-2" data-testid="badge-ai-confidence">
                    AI: {aiConfidence}% confident
                  </Badge>
                )}
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-2 left-2"
                  onClick={() => {
                    setUploadedImage(null);
                    setAiConfidence(null);
                  }}
                  data-testid="button-remove-image"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Expense Details Form */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <Label htmlFor="total">Total Amount *</Label>
              <Input
                id="total"
                type="number"
                step="0.01"
                placeholder="84.20"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                className="text-2xl font-mono"
                data-testid="input-total"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Dinner at restaurant"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                data-testid="input-description"
              />
            </div>

            <div>
              <Label>Category</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {CATEGORIES.map((cat) => (
                  <Button
                    key={cat}
                    variant={category === cat ? "default" : "outline"}
                    onClick={() => setCategory(cat)}
                    className="justify-start"
                    data-testid={`button-category-${cat.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="payer">Paid By</Label>
              <Input
                id="payer"
                placeholder="@username"
                value={payer}
                onChange={(e) => setPayer(e.target.value)}
                data-testid="input-payer"
              />
            </div>

            <div>
              <Label>Split With</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="@username"
                  value={newParticipant}
                  onChange={(e) => setNewParticipant(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addParticipant()}
                  data-testid="input-add-participant"
                />
                <Button onClick={addParticipant} data-testid="button-add-participant">
                  <Check className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {participants.map((p) => (
                  <Badge
                    key={p}
                    variant="secondary"
                    className="gap-1"
                    data-testid={`badge-participant-${p}`}
                  >
                    {p}
                    {p !== payer && (
                      <button
                        onClick={() => removeParticipant(p)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !total}
          className="w-full"
          size="lg"
          data-testid="button-submit"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding...
            </>
          ) : (
            "Add Expense"
          )}
        </Button>
      </div>

      <CaptureBar onPhotoCapture={handlePhotoCapture} onTextInput={handleTextInput} />
    </div>
  );
}
