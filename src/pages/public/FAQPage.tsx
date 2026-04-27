import { PageHeader } from "@/components/PageHeader";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqs } from "@/data/patientContent";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";

const FAQPage = () => {
  return (
    <>
      <PageHeader
        eyebrow="Para pacientes"
        title="Perguntas frequentes"
        description="Dúvidas comuns sobre doenças valvares, tratamentos e o uso do ValvePath."
        breadcrumbs={[{ label: "Aprender", to: "/aprender" }, { label: "Perguntas frequentes" }]}
      />
      <section className="container-vp py-10 max-w-3xl">
        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border border-border rounded-xl px-5 bg-card">
              <AccordionTrigger className="text-left font-display font-semibold text-base hover:no-underline">
                {f.question}
              </AccordionTrigger>
              <AccordionContent className="text-base text-foreground/85 leading-relaxed pb-4">
                {f.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-10">
          <MedicalDisclaimer />
        </div>
      </section>
    </>
  );
};

export default FAQPage;
