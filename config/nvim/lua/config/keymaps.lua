-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here

-- 選択範囲をファイル名と行番号付きでコピー
vim.keymap.set("v", "<leader>y", function()
  local start_line = vim.fn.line("'<")
  local end_line = vim.fn.line("'>")
  local file = vim.fn.expand("%")
  local lines = vim.fn.getline(start_line, end_line)

  local text = "file: "
    .. file
    .. "\n"
    .. "lines: "
    .. start_line
    .. "-"
    .. end_line
    .. "\n\n"
    .. table.concat(lines, "\n")

  vim.fn.setreg("+", text)
  vim.notify("Copied with location info", vim.log.levels.INFO)
end, { desc = "Copy with file location" })

-- yaziで現在のファイルを表示
vim.keymap.set("n", "<leader>Y", function()
  local path = vim.fn.expand("%:p")
  vim.fn.system('ya emit-to 1 reveal "' .. path .. '"')
end, { desc = "Reveal in yazi" })
