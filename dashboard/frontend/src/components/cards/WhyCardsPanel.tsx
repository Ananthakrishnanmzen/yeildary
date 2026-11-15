import WhyCard from "@/components/cards/WhyCard";

export default function WhyCardsPanel({
  crop,
  rationale,
}: {
  crop: string;
  rationale: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-3">
      <WhyCard crop={crop} rationale={rationale} />
    </div>
  );
}
