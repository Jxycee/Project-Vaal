# Third-Party Notices

Project Vaal includes or depends on the following third-party software.

## @poe2-toolkit (tree-core, tree-react, item-extractor, gem-extractor, mod-extractor)

The passive skill tree viewer is built on the **poe2-toolkit** libraries by
Vladislav Rajtmajer (`rajtik76`) — a headless geometry engine (`tree-core`) and
a PixiJS React view (`tree-react`) that render the Path of Exile 2 passive tree
faithfully from GGG's official export.

The same toolkit also supplies the item/skill/mod wiki's data and icons: the
`item-extractor`, `gem-extractor`, and `mod-extractor` packages decode item,
gem, and mod data (and associated icons) from the game's official patch
server, which the wiki sync script normalizes into the site's browse and
detail pages.

- Source: https://github.com/rajtik76/poe2-toolkit
- License: MIT

```
MIT License

Copyright (c) 2026 Vladislav Rajtmajer

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Project Vaal is an independent project and is not affiliated with or endorsed by
Vladislav Rajtmajer or the poe2-toolkit project.

## PathOfBuilding-PoE2 (QuestRewards.lua)

The Campaign Tracker's quest reward data (passive skill points and attribute/stat
rewards per act/area) is cross-checked against `QuestRewards.lua` from the
**PathOfBuildingCommunity/PathOfBuilding-PoE2** project, a community-maintained
Path of Building fork kept current for Path of Exile 2.

- Source: https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/blob/dev/src/Data/QuestRewards.lua
- License: MIT

```
Copyright (c) 2016 David Gowor

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Project Vaal is an independent project and is not affiliated with or endorsed by
the Path of Building Community.
