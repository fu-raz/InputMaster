; InputMaster NSIS hooks — no Virtual Audio installer/uninstaller pages or components.

!macro INPUTMASTER_DELETE_LEGACY_RUN_VALUE
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "MIDIMaster"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "InputMaster"
!macroend

!macro INPUTMASTER_DELETE_STARTUP_SHORTCUT
  Delete "$SMSTARTUP\MIDIMaster.lnk"
  Delete "$SMSTARTUP\InputMaster.lnk"
!macroend

!macro INPUTMASTER_WRITE_INSTALL_MARKER
  ClearErrors
  FileOpen $0 "$INSTDIR\.inputmaster-installed" w
  IfErrors +4
  FileWrite $0 "InputMaster installed by NSIS$\r$\n"
  FileClose $0
  SetFileAttributes "$INSTDIR\.inputmaster-installed" HIDDEN
!macroend

!macro NSIS_HOOK_POSTINSTALL
  !insertmacro INPUTMASTER_DELETE_LEGACY_RUN_VALUE
  !insertmacro INPUTMASTER_WRITE_INSTALL_MARKER
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro INPUTMASTER_DELETE_LEGACY_RUN_VALUE
  !insertmacro INPUTMASTER_DELETE_STARTUP_SHORTCUT
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  !insertmacro INPUTMASTER_DELETE_LEGACY_RUN_VALUE
  !insertmacro INPUTMASTER_DELETE_STARTUP_SHORTCUT
!macroend
