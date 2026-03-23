return {
  "folke/snacks.nvim",
  opts = {
    picker = {
      sources = {
        explorer = {
          layout = {
            layout = {
              backdrop = false,
              width = 40,
              min_width = 40,
              height = 0,
              position = "left",
              border = "none",
              box = "vertical",
              { win = "list", border = "none" },
            },
          },
        },
      },
    },
  },
}
