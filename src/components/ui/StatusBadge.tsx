const tones: Record<string, string> = {
  Started: "stone",
  Written: "sand",
  "Bounce In": "amber",
  "Assets Filed": "latte",
  Pitched: "plum",
  "On Hold": "mauve",
  Cut: "cocoa",
  Approved: "sage",
  Released: "gold",
  Disputed: "rose",
  Registered: "coffee",
  Complete: "olive",
  Weak: "rose",
  Partial: "amber",
  Strong: "sage",
  CompleteEvidence: "olive",
};

export default function StatusBadge({ label }: { label: string }) {
  const tone = tones[label] || "stone";
  return <span className={`statusBadge ${tone}`}>{label}</span>;
}
