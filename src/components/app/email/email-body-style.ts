/**
 * Typography applied to email markup wherever it is shown — inside the editor
 * and inside the preview. Tailwind's reset strips list markers and heading
 * sizes, so without these an authored bullet list looks like plain lines in
 * the app while arriving as a real list in someone's inbox.
 */
export const EMAIL_BODY_CLASS = [
  'text-sm leading-relaxed',
  '[&_p]:my-2',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
  '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_li]:my-0.5',
  '[&_strong]:font-semibold [&_em]:italic [&_u]:underline [&_s]:line-through',
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
  '[&_h1]:my-2 [&_h1]:text-lg [&_h1]:font-semibold',
  '[&_h2]:my-2 [&_h2]:text-base [&_h2]:font-semibold',
  '[&_h3]:my-2 [&_h3]:text-sm [&_h3]:font-semibold',
  '[&_h4]:my-2 [&_h4]:text-sm [&_h4]:font-medium',
  '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
  '[&_hr]:my-3 [&_hr]:border-border',
  '[&_img]:max-w-full',
  '[&_table]:my-2 [&_td]:px-2 [&_td]:py-1 [&_th]:px-2 [&_th]:py-1',
].join(' ')
