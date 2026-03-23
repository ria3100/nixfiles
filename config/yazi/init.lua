-- yazi init.lua

-- Git連携
require("git"):setup {
  order = 1500,
}

-- ステータスバー非表示
require("no-status"):setup()

-- ステータスバーにファイルのオーナーを表示する例（コメントアウト）
-- Status:children_add(function()
--   local h = cx.active.current.hovered
--   if h == nil or ya.target_family() ~= "unix" then
--     return ui.Line {}
--   end
--
--   return ui.Line {
--     ui.Span(ya.user_name(h.cha.uid) or tostring(h.cha.uid)):fg("magenta"),
--     ui.Span(":"),
--     ui.Span(ya.group_name(h.cha.gid) or tostring(h.cha.gid)):fg("magenta"),
--     ui.Span(" "),
--   }
-- end, 500, Status.RIGHT)
