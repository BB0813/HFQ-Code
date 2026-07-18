import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
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
        <div
          className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
          role="alert"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div className="text-sm font-medium text-destructive">
            {this.props.label
              ? `${this.props.label} 渲染失败`
              : "界面渲染失败"}
          </div>
          <pre className="selectable max-w-lg overflow-auto rounded-md border border-border bg-muted/40 p-3 text-left text-xs text-muted-foreground">
            {this.state.error.message}
          </pre>
          <Button
            size="sm"
            variant="outline"
            onClick={() => this.setState({ error: null })}
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            重试
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
