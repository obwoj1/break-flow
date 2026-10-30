import type { BreakFlowApi } from '../../shared/types'

declare global {
  interface Window {
    breakFlow: BreakFlowApi
  }
}
