# Other PC trust install (tutorial 2.2.4)

## What this folder is for

Self-signed signatures only work on other PCs AFTER the root cert
is installed into "Trusted Root Certification Authorities".

## Files

| File | Purpose |
|------|---------|
| HFQ-ClodBreeze.cer | Public certificate |
| root.spc | PKCS#7 for certmgr (tutorial style) |
| certmgr.exe | Tutorial tool |
| config.bat | Semi-auto install (popup + UAC) |
| config-silent.bat | Silent install (only UAC, no msgbox) |
| Install-Trust.bat | Manual double-click installer |

## Recommended usage (like the article)

1. Ship your app + this whole folder together
2. Before starting the main program, run:

   config.bat

   or call it from your installer / launcher:

   call "%~dp0config-silent.bat"

3. Marker file %TEMP%\HFQ-ClodBreeze.trust.key means already done

## Tutorial command (what config does)

certmgr.exe -add -c root.spc -s -r localMachine root

Modern fallback:

certutil -addstore -f Root HFQ-ClodBreeze.cer
certutil -addstore -f TrustedPublisher HFQ-ClodBreeze.cer

## Notes

- Still needs Administrator (UAC). True zero-prompt install is not possible without prior admin rights.
- Antivirus may block writing to LocalMachine Root - allow it.
- SmartScreen cloud reputation may still warn; this only fixes untrusted publisher / UAC name.
- Do NOT ship root.pfx or passwords.
