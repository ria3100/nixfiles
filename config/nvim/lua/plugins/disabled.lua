-- LazyVim の既定から外すプラグイン
return {
  -- バッファのタブ表示は使わない
  { "akinsho/bufferline.nvim", enabled = false },
  -- テーマは monokai（colorscheme.lua）だけ使う
  { "folke/tokyonight.nvim", enabled = false },
  { "catppuccin/nvim", enabled = false },
  -- セッションの復元は使わない
  { "folke/persistence.nvim", enabled = false },
}
