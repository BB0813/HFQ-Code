; Custom NSIS steps: import HFQ-ClodBreeze trust after files are installed.
; electron-builder layout: extraResources land under $INSTDIR\resources\
; Trust pack path: $INSTDIR\resources\trust\config-silent.bat

!macro customInstall
  DetailPrint "HFQ Code: importing publisher trust (HFQ-ClodBreeze)…"
  IfFileExists "$INSTDIR\resources\trust\config-silent.bat" 0 hfq_trust_missing
    ; Elevate already required when nsis.perMachine / admin install is used.
    nsExec::ExecToLog '"$INSTDIR\resources\trust\config-silent.bat"'
    Pop $0
    DetailPrint "HFQ Code: trust import exit code $0"
    Goto hfq_trust_done
  hfq_trust_missing:
    DetailPrint "HFQ Code: trust pack not found at $INSTDIR\resources\trust (skip)"
  hfq_trust_done:
!macroend
