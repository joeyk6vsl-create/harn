# Haan — ຫານຄ່າອາຫານກັບໝູ່

ເວັບພາສາລາວ ອອກແບບສຳລັບມືຖື. ບໍ່ຕ້ອງມີ backend, database, API key ຫຼືຕິດຕັ້ງ dependencies.

## ອັບຂຶ້ນ GitHub Pages

1. ແຕກ ZIP ແລ້ວອັບໂຫຼດໄຟລ໌ຂ້າງໃນ `haan-github` ເຂົ້າ repository. ໃຫ້ `docs/index.html` ຢູ່ຕາມໂຄງສ້າງນີ້.
2. ເຂົ້າ **Settings → Pages → Build and deployment → Deploy from a branch**.
3. ເລືອກ **main**, ໂຟນເດີ **/docs**, ແລ້ວ **Save**.
4. ລໍຖ້າ GitHub ສ້າງເວັບ ແລ້ວເປີດລິ້ງທີ່ສະແດງໃນ Pages ດ້ວຍມືຖື.

ບໍ່ຕ້ອງ build. ໃຊ້ relative asset paths ຈຶ່ງຮອງຮັບ URL ທີ່ມີຊື່ repository.
[ຄູ່ມື GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## ວິທີໃຊ້

- ເປີດເມນູ → **ກຸ່ມໝູ່ → ສ້າງກຸ່ມ**. ໃສ່ຊື່ກຸ່ມ ແລະຊື່ໝູ່ໜຶ່ງຄົນຕໍ່ແຖວ (1–40 ຄົນ).
- ສ້າງບິນໃໝ່ ແລ້ວເລືອກກຸ່ມ. ລຶບຊື່ຄົນທີ່ບໍ່ມາອອກຈາກບິນໄດ້ ໂດຍບໍ່ປ່ຽນກຸ່ມປະຈຳ.
- ເພີ່ມອາຫານ: ລາຄາຕໍ່ໜ່ວຍ × ຈຳນວນ. ເລືອກຄົນກິນ ແລະຄົນອອກເງິນໃນແຕ່ລະລາຍການ.
- ເລືອກຫານຕາມລາຍການ ຫຼືເທົ່າກັນ. ເບິ່ງສະຫຼຸບການໂອນ ແລະຄັດລອກສົ່ງໃຫ້ໝູ່.
- ການແກ້ໄຂກຸ່ມຈະບໍ່ປ່ຽນລາຍຊື່ໃນບິນເກົ່າ.

## ຂໍ້ມູນບັນທຶກຢູ່ໃສ?

ກຸ່ມ ແລະບິນບັນທຶກອັດຕະໂນມັດໃນ localStorage ຂອງ browser ທີ່ເປີດເວັບນັ້ນ. GitHub ເກັບແຕ່ໂຄດ; ບໍ່ໄດ້ເກັບລາຍຊື່ໝູ່ ຫຼືບິນ. ເປີດຄືນໃນ browser ເດີມໄດ້, ແຕ່ບໍ່ຊິງຂ້າມເຄື່ອງ. ໃຊ້ **ສຳຮອງ** ເພື່ອດາວໂຫຼດ JSON ແລະ **ນຳເຂົ້າ** ເມື່ອຍ້າຍເຄື່ອງ/ຍ້າຍ URL. ນຳເຂົ້າຈະແທນທີ່ທັງກຸ່ມແລະບິນ ໂດຍມີການຢືນຢັນກ່ອນ.

ລ້າງຂໍ້ມູນ browser ຫຼືໃຊ້ private mode ອາດເຮັດໃຫ້ຂໍ້ມູນຫາຍ. ຄວນສຳຮອງເປັນປະຈຳ. ໄຟລ໌ສຳຮອງຈາກເວີຊັນ 1 ນຳເຂົ້າໄດ້; ຈຳນວນເກົ່າຖືເປັນ 1.

## Local development

Requires Node.js 20+. Run `node scripts/serve.mjs`, then open http://localhost:4173. Windows users can use `Start-Haan.cmd`. Do not open index.html directly using file://; JavaScript modules require an HTTP origin. The local preview server is only a development tool; GitHub hosts the static files in production.

Checks: `node --check docs/app.js`, `node --check docs/core.js`, `node --test tests/*.test.mjs`.

`docs/core.js` contains pure integer-kip allocation, quantity validation, settlement and backup migration. `docs/app.js` contains UI and local persistence. `docs/styles.css` follows the supplied layout guide: 16px Lao body text, blue controls, white/gray surfaces, 44px controls, 48px inputs and mobile single-column forms. Google Fonts is optional; system Lao fonts are fallback. This is not a fully offline PWA or a WCAG certification.

Limits: 100 bills, 100 groups, 40 members per group/bill, 300 items per bill, quantity 1–999, line total up to 1,000,000,000 kip. Remainders are allocated deterministically by member order. Settlement nets balances into a short plan without claiming a globally minimal number of transfers. Each item has one payer; split an item into separate payment lines if several people paid for it.
