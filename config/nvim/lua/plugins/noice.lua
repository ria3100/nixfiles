return {
  {
    "folke/noice.nvim",
    opts = {
      cmdline = {
        enabled = true,
        view = "cmdline", -- クラシックなコマンドライン表示（左下）
      },
      messages = {
        enabled = true,
        view = "notify", -- メッセージは通知で表示
        view_error = "notify",
        view_warn = "notify",
        view_history = "messages",
        view_search = "virtualtext",
      },
      popupmenu = {
        enabled = true,
        backend = "nui", -- 補完メニューは標準表示
      },
      notify = {
        enabled = true,
        view = "notify",
      },
      lsp = {
        progress = {
          enabled = true,
        },
        override = {
          ["vim.lsp.util.convert_input_to_markdown_lines"] = true,
          ["vim.lsp.util.stylize_markdown"] = true,
          ["cmp.entry.get_documentation"] = true,
        },
      },
      presets = {
        bottom_search = true, -- 検索を下部に配置
        command_palette = false, -- コマンドパレットを無効化
        long_message_to_split = true, -- 長いメッセージを分割
        inc_rename = false,
        lsp_doc_border = false,
      },
    },
  },
}
