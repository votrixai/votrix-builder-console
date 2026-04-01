"use client";

import { useEffect, useCallback, useRef } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $createParagraphNode, $createTextNode, EditorState } from "lexical";

const theme = {
  paragraph: "editor-paragraph",
};

function SetContentPlugin({
  content,
  lastEditorTextRef,
}: {
  content: string;
  lastEditorTextRef: React.MutableRefObject<string | null>;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (content === lastEditorTextRef.current) return;
    editor.update(() => {
      const root = $getRoot();
      root.clear();
      const lines = content.split("\n");
      for (const line of lines) {
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode(line));
        root.append(paragraph);
      }
    });
    lastEditorTextRef.current = content;
  }, [editor, content, lastEditorTextRef]);

  return null;
}

export default function Editor({
  content,
  onChange,
}: {
  content: string;
  onChange?: (text: string) => void;
}) {
  const initialConfig = {
    namespace: "CodeEditor",
    theme,
    onError: (error: Error) => console.error(error),
    editorState: undefined,
  };

  const lastEditorTextRef = useRef<string | null>(null);

  const handleChange = useCallback(
    (editorState: EditorState) => {
      if (!onChange) return;
      editorState.read(() => {
        const root = $getRoot();
        const text = root
          .getChildren()
          .map((node) => node.getTextContent())
          .join("\n");
        lastEditorTextRef.current = text;
        onChange(text);
      });
    },
    [onChange]
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="relative h-full w-full font-mono text-sm">
        <PlainTextPlugin
          contentEditable={
            <ContentEditable className="h-full w-full p-4 outline-none caret-gray-800 text-gray-800" />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <SetContentPlugin content={content} lastEditorTextRef={lastEditorTextRef} />
        <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
      </div>
    </LexicalComposer>
  );
}
