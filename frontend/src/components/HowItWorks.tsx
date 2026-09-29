// src/components/HowItWorks.tsx
import React, { useMemo, useState } from "react";

const HowItWorks: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = useMemo(
    () => [
      {
        title: "Upload Your Inspo",
        description:
          "Share an image of an outfit you love. Our AI analyzes the details to understand your aesthetic.",
      },
      {
        title: "AI Curates",
        description:
          "Advanced algorithms identify style elements, silhouettes, textures, and patterns.",
      },
      {
        title: "Shop Your Style",
        description:
          "Browse items curated specifically to match the mood and DNA of your inspiration.",
      },
    ],
    []
  );

  const handleNextStep = () => {
    setCurrentStep((prev) => (prev + 1) % steps.length);
  };

  return (
    <section className="w-full bg-gray-100 py-16 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />

      <div className="container mx-auto px-4 grid md:grid-cols-2 gap-10 items-start">
        <div
          className="relative h-[480px] overflow-hidden cursor-pointer"
          onClick={handleNextStep}
          role="button"
          aria-label="Cycle how-it-works steps"
        >
          <img
            src={
              currentStep === 0
                ? "/src/assets/images/Home/clothing.jpg"
                : currentStep === 1
                  ? "/src/assets/images/Home/shoes.jpg"
                  : "/src/assets/images/Home/accessories.jpg"
            }
            alt={steps[currentStep].title}
            className="w-full h-full object-cover transition-all duration-500"
          />

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentStep(i);
                }}
                className={`h-2 rounded-full transition-all duration-300 ${currentStep === i ? "w-6 bg-white" : "w-2 bg-white/50"
                  }`}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-2xl font-medium text-gray-900">
            {steps[currentStep].title}
          </h3>
          <div className="w-16 h-px bg-[#213A53] mb-6" />

          <div className="space-y-4 border-t border-gray-300 pt-6">
            {steps.map((step, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`flex items-start gap-4 text-left w-full transition-opacity ${currentStep === i ? "opacity-100" : "opacity-50 hover:opacity-80"
                  }`}
              >
                <span className="text-lg font-light text-gray-400">
                  {String(i + 1).padStart(2, "0")}
                </span>

                <div>
                  <p className="text-base font-medium text-gray-900">{step.title}</p>
                  <p className="text-sm text-gray-600">{step.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
