import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorPanel } from '../../ui/components/Notice.tsx';
import { todayCopy } from '../../copy/today.ts';

/**
 * 予測の表示だけを囲む Error Boundary。表示データへの変換と検査（assertForecastPresentation）もこの内側で行う。
 * 記録の2択はこの外に置くので、予測の表示が失敗しても記録はできる。
 * 新しいデータを受け取ったら親が key を変えて、失敗の状態から戻す。
 */
export class ForecastBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    // 利用者には内部の情報を出さず、開発者が原因を追えるようにログへ残す
    console.error('Today の見通しを表示できませんでした', error, info.componentStack);
  }

  override render() {
    if (this.state.failed) {
      return (
        <div className="fr-today__pad">
          <ErrorPanel title={todayCopy.renderErrorTitle}>{todayCopy.renderError}</ErrorPanel>
        </div>
      );
    }
    return this.props.children;
  }
}
