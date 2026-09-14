@echo off
rem 双击即可：本地预览打不开 / 打开是白板时，修复 5173 上的预览服务。
rem 不会动内容编辑器和你的内容，只重建 Vite 的依赖缓存。
chcp 65001 >nul
cd /d "%~dp0.."
echo.
node site-editor\fix-preview.cjs
echo.
pause
