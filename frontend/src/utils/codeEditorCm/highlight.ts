import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

export const codeEditorCmHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: [t.keyword, t.modifier, t.controlKeyword], color: 'var(--syntax-keyword)' },
    { tag: [t.propertyName, t.attributeName], color: 'var(--syntax-property)' },
    { tag: [t.string, t.special(t.string)], color: 'var(--syntax-string)' },
    { tag: [t.number, t.integer, t.float], color: 'var(--syntax-number)' },
    { tag: [t.bool, t.null, t.atom], color: 'var(--syntax-bool)' },
    { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--syntax-comment)', fontStyle: 'italic' },
    { tag: [t.bracket, t.punctuation, t.separator], color: 'var(--syntax-bracket)' },
    { tag: [t.variableName, t.definition(t.variableName)], color: 'var(--text-primary)' },
    { tag: [t.function(t.variableName), t.definition(t.function(t.variableName))], color: 'var(--syntax-def)' },
    { tag: [t.className, t.typeName], color: 'var(--syntax-def)' },
    { tag: t.invalid, color: 'var(--error)' },
  ]),
);
