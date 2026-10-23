import { test, expect } from '@playwright/test';
import { launchDesktop } from './desktop-helper';
import { addDays, dateKey } from '../src/core/date';

test('calendar leave updates historical and future income and survives restart', async () => {
  test.setTimeout(120000);
  const today = dateKey(new Date()), past = addDays(today,-1), future = addDays(today,1);
  const s = await launchDesktop(state => {
    state.startDate = past;
    for (const d of [past,today,future]) state.overrides[d] = true;
  });
  try {
    await s.page.evaluate(()=>window.buddy.hideCompanion());
    await s.page.getByRole('button',{name:'工作日历',exact:true}).click();
    // Open via the same navigation interface used by the desktop card; supports month boundaries.
    await s.page.evaluate(d=>window.buddy.openPanel({page:'calendar',date:d}),past);
    await expect(s.page.getByRole('dialog')).toBeVisible();
    await s.page.getByLabel('请假开始时间',{exact:true}).fill('11:00');
    await s.page.getByLabel('请假结束时间',{exact:true}).fill('14:00');
    await s.page.getByRole('button',{name:'添加请假',exact:true}).click();
    await expect(s.page.locator('.leave-summary')).toHaveText('扣薪时长 120 分钟 · 全天扣减 ¥200.00');
    await expect.poll(()=>s.page.evaluate(d=>window.buddy.getSnapshot().then(x=>x.state.ledger[d].amountCents),past)).toBe(60000);
    await s.page.getByRole('button',{name:'关闭',exact:true}).click();
    await s.page.evaluate(d=>window.buddy.openPanel({page:'calendar',date:d}),future);
    await s.page.getByLabel('请假开始时间',{exact:true}).fill('09:00');
    await s.page.getByLabel('请假结束时间',{exact:true}).fill('18:00');
    await s.page.getByRole('button',{name:'添加请假',exact:true}).click();
    await expect(s.page.locator('.leave-summary')).toHaveText('扣薪时长 480 分钟 · 全天扣减 ¥800.00');
    await s.page.getByRole('button',{name:'关闭',exact:true}).click();
    await expect(s.page.getByRole('button',{name:new RegExp(`^${future} `)})).toContainText('预计 ¥0.00');
    await s.page.screenshot({path:'test-results/leave-calendar.png'});
    const next = await s.restart();
    await next.page.evaluate(()=>window.buddy.hideCompanion());
    const loaded = await next.page.evaluate(()=>window.buddy.getSnapshot());
    expect(loaded.state.ledger[past].amountCents).toBe(60000);
    expect(loaded.state.leaves?.[future]).toEqual([{start:540,end:1080}]);
    await next.page.evaluate(d=>window.buddy.openPanel({page:'calendar',date:d}),past);
    await next.page.getByRole('button',{name:'删除请假 11:00–14:00',exact:true}).click();
    await expect.poll(()=>next.page.evaluate(d=>window.buddy.getSnapshot().then(x=>x.state.ledger[d].amountCents),past)).toBe(80000);
    await next.page.screenshot({path:'test-results/leave-dialog.png'});
  } finally { await s.cleanup(); }
});
