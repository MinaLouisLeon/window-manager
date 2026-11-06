import { ThemeProvider } from '@integr8-media/ui';

// M0: only proves the package installs and its styles load. M11 renders the full shell here.
export function App() {
  return (
    <ThemeProvider defaultTheme="light">
      <main data-testid="fixture-root">
        <h1 data-testid="heading">Window manager fixture</h1>
      </main>
    </ThemeProvider>
  );
}
