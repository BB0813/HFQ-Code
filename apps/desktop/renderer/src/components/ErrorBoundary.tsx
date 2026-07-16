import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[HFQ UI]", this.props.label ?? "error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="text-sm font-medium text-destructive">界面渲染失败</div>
          <pre className="selectable max-w-lg overflow-auto rounded-md border border-border bg-muted/40 p-3 text-left text-xs text-muted-foreground">
            {this.state.error.message}
          </pre>
          <Button size="sm" variant="outline" onClick={() => this.setState({ error: null })}>
            重试
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
