import PromptSuggestionButton from "./PromptSuggestionButton";

const PromptSuggestionsRow = ({ onPromptClick }) => {
  const prompts = [
    "What are the key factors that contribute to a Formula 1 car's performance?",
    "How does tire strategy affect race outcomes in Formula 1?",
    "Can you explain the role of aerodynamics in Formula 1 car design?",
    "What is the process for designing a Formula 1 circuit?",
  ];
  return (
    <div className="prompt-suggestions-row">
      {prompts.map((prompt, index) => (
        <PromptSuggestionButton
          key={`suggestion-${index}`}
          text={prompt}
          onClick={() => onPromptClick(prompt)}
        />
      ))}
    </div>
  );
};

export default PromptSuggestionsRow;
