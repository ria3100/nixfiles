-- Options are automatically loaded before lazy.nvim startup
-- Default options that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/options.lua
-- Add any additional options here

-- CursorHold の発火を速くする
vim.opt.updatetime = 200

-- h/lで行をまたいで移動
vim.opt.whichwrap:append("h,l,<,>,[,]")

-- 行番号表示を通常の番号に（相対行番号を無効化）
vim.opt.relativenumber = false
vim.opt.number = true


-- 行番号の幅を狭く設定
vim.opt.numberwidth = 1
vim.opt.signcolumn = "yes"

-- 行番号の余白を減らすためstatuscolumnをカスタマイズ
vim.opt.statuscolumn = "%s %=%{v:lnum} "

-- diff の削除行の埋め文字を空白にする（///を非表示）
vim.opt.fillchars:append({ diff = " " })

-- セマンティックハイライトを無効化
vim.g.semantic_tokens_enabled = false

-- 背景を透明にする設定
vim.api.nvim_create_autocmd({ "VimEnter", "ColorScheme" }, {
  pattern = "*",
  callback = function()
    -- 透明にするハイライトグループ
    local transparent_groups = {
      "Normal",
      "NormalFloat",
      "NormalNC",
      "SignColumn",
      "EndOfBuffer",
      "LineNr",
      "CursorLineNr",
      "Folded",
      "NonText",
      "SpecialKey",
      "VertSplit",
      "WinSeparator",
      "StatusLine",
      "StatusLineNC",
      "MsgArea",
      "FloatBorder",
      "NormalSB",
      "NvimTreeNormal",
    }

    for _, group in ipairs(transparent_groups) do
      vim.api.nvim_set_hl(0, group, { bg = "NONE", ctermbg = "NONE" })
    end

    -- インデントガイドの色を薄く設定
    vim.api.nvim_set_hl(0, "SnacksIndent", { fg = "#3a3a3a" })
    vim.api.nvim_set_hl(0, "SnacksIndentScope", { fg = "#4a4a4a" })

    -- Neo-treeのインデントガイドもエディタと同じ色に設定（リンクを解除）
    vim.api.nvim_set_hl(0, "SnackPickerTree", { fg = "#3a3a3a", default = false })
    vim.api.nvim_set_hl(0, "NeoTreeIndentMarker", { fg = "#3a3a3a" })
    vim.api.nvim_set_hl(0, "NeoTreeExpander", { fg = "#3a3a3a" })

    -- 行番号と罫線をコメントと同じ薄い色に設定
    vim.api.nvim_set_hl(0, "LineNr", { fg = "#75715e" })
    vim.api.nvim_set_hl(0, "CursorLineNr", { fg = "#75715e" })
    vim.api.nvim_set_hl(0, "WinSeparator", { fg = "#75715e" })
    vim.api.nvim_set_hl(0, "VertSplit", { fg = "#75715e" })
  end,
})

-- LSPのセマンティックハイライトを完全に無効化
vim.api.nvim_create_autocmd("LspAttach", {
  callback = function(args)
    local client = vim.lsp.get_client_by_id(args.data.client_id)
    if client then
      client.server_capabilities.semanticTokensProvider = nil
    end
  end,
})

