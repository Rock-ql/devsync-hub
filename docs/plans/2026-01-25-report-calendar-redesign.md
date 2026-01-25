# 日报周报页面重新设计 实施计划

> **对于 Claude：** 必需的子技能：使用 superpowers:executing-plans 按任务逐步实施此计划。

**目标：** 在 Reports 页面实现“日历 + 周报行 + 详情面板”的新布局，并新增后端按月汇总接口支撑日报/周报完成状态。

**架构：** 前端通过 `/api/report/month-summary` 拉取指定月汇总数据，基于 date-fns 构建 7x6 日历网格与周报行；点击日期/周报行按需请求 `/api/report/detail/{id}` 渲染详情。后端在 ReportService 中新增月度汇总查询与周序号计算，Controller 暴露 POST 接口。

**技术栈：** React + React Query + Tailwind + date-fns；Spring Boot + MyBatis-Plus。

---

相关技能：@writing-plans

### 任务 1: 后端新增月度汇总接口

**文件：**
- 创建：`backend/src/main/java/com/devsync/dto/req/ReportMonthSummaryReq.java`
- 创建：`backend/src/main/java/com/devsync/dto/rsp/ReportMonthSummaryRsp.java`
- 修改：`backend/src/main/java/com/devsync/service/IReportService.java`
- 修改：`backend/src/main/java/com/devsync/service/impl/ReportServiceImpl.java`
- 修改：`backend/src/main/java/com/devsync/controller/ReportController.java`

**步骤 1: 添加请求/响应 DTO**

```java
// backend/src/main/java/com/devsync/dto/req/ReportMonthSummaryReq.java
package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 报告月度汇总请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "报告月度汇总请求")
public class ReportMonthSummaryReq {

    @NotNull(message = "年份不能为空")
    @Min(value = 1970, message = "年份不能小于1970")
    @Schema(description = "年份")
    private Integer year;

    @NotNull(message = "月份不能为空")
    @Min(value = 1, message = "月份不能小于1")
    @Max(value = 12, message = "月份不能大于12")
    @Schema(description = "月份")
    private Integer month;
}
```

```java
// backend/src/main/java/com/devsync/dto/rsp/ReportMonthSummaryRsp.java
package com.devsync.dto.rsp;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

/**
 * 报告月度汇总响应
 *
 * @author xiaolei
 */
@Data
@Schema(description = "报告月度汇总响应")
public class ReportMonthSummaryRsp {

    @Schema(description = "日报列表")
    private List<DailyReportSummary> dailyReports;

    @Schema(description = "周报列表")
    private List<WeeklyReportSummary> weeklyReports;

    @Data
    @Schema(description = "日报简要信息")
    public static class DailyReportSummary {

        @Schema(description = "日报日期")
        private LocalDate date;

        @Schema(description = "报告ID")
        private Integer id;

        @Schema(description = "标题")
        private String title;
    }

    @Data
    @Schema(description = "周报简要信息")
    public static class WeeklyReportSummary {

        @Schema(description = "第几周（以月为单位）")
        private Integer weekNumber;

        @Schema(description = "报告ID")
        private Integer id;

        @Schema(description = "开始日期")
        private LocalDate startDate;

        @Schema(description = "结束日期")
        private LocalDate endDate;
    }
}
```

**步骤 2: 扩展服务接口**

```java
// backend/src/main/java/com/devsync/service/IReportService.java
import com.devsync.dto.req.ReportMonthSummaryReq;
import com.devsync.dto.rsp.ReportMonthSummaryRsp;

ReportMonthSummaryRsp getMonthSummary(ReportMonthSummaryReq req);
```

**步骤 3: 实现月度汇总逻辑**

```java
// backend/src/main/java/com/devsync/service/impl/ReportServiceImpl.java
import com.devsync.dto.req.ReportMonthSummaryReq;
import com.devsync.dto.rsp.ReportMonthSummaryRsp;
import java.time.LocalDate;
import java.time.YearMonth;

@Override
public ReportMonthSummaryRsp getMonthSummary(ReportMonthSummaryReq req) {
    YearMonth yearMonth = YearMonth.of(req.getYear(), req.getMonth());
    LocalDate monthStart = yearMonth.atDay(1);
    LocalDate monthEnd = yearMonth.atEndOfMonth();

    LambdaQueryWrapper<Report> dailyWrapper = new LambdaQueryWrapper<>();
    dailyWrapper.eq(Report::getType, ReportTypeEnum.DAILY.getCode())
            .ge(Report::getStartDate, monthStart)
            .le(Report::getStartDate, monthEnd)
            .orderByAsc(Report::getStartDate);

    List<Report> dailyReports = reportMapper.selectList(dailyWrapper);

    LambdaQueryWrapper<Report> weeklyWrapper = new LambdaQueryWrapper<>();
    weeklyWrapper.eq(Report::getType, ReportTypeEnum.WEEKLY.getCode())
            .le(Report::getStartDate, monthEnd)
            .ge(Report::getEndDate, monthStart)
            .orderByAsc(Report::getStartDate);

    List<Report> weeklyReports = reportMapper.selectList(weeklyWrapper);

    ReportMonthSummaryRsp rsp = new ReportMonthSummaryRsp();
    rsp.setDailyReports(dailyReports.stream().map(report -> {
        ReportMonthSummaryRsp.DailyReportSummary item = new ReportMonthSummaryRsp.DailyReportSummary();
        item.setId(report.getId());
        item.setTitle(report.getTitle());
        item.setDate(report.getStartDate());
        return item;
    }).toList());

    rsp.setWeeklyReports(weeklyReports.stream().map(report -> {
        ReportMonthSummaryRsp.WeeklyReportSummary item = new ReportMonthSummaryRsp.WeeklyReportSummary();
        LocalDate anchorDate = report.getStartDate().isBefore(monthStart) ? monthStart : report.getStartDate();
        item.setWeekNumber(resolveWeekNumber(anchorDate, monthStart));
        item.setId(report.getId());
        item.setStartDate(report.getStartDate());
        item.setEndDate(report.getEndDate());
        return item;
    }).toList());

    return rsp;
}

private int resolveWeekNumber(LocalDate anchorDate, LocalDate monthStart) {
    int offset = monthStart.getDayOfWeek().getValue() - 1;
    int index = anchorDate.getDayOfMonth() + offset - 1;
    return index / 7 + 1;
}
```

**步骤 4: 新增控制器接口**

```java
// backend/src/main/java/com/devsync/controller/ReportController.java
import com.devsync.dto.req.ReportMonthSummaryReq;
import com.devsync.dto.rsp.ReportMonthSummaryRsp;

@PostMapping("/month-summary")
@Operation(summary = "获取报告月度汇总")
public Result<ReportMonthSummaryRsp> monthSummary(@Valid @RequestBody ReportMonthSummaryReq req) {
    return Result.success(reportService.getMonthSummary(req));
}
```

**步骤 5: 运行后端编译验证**

运行：`mvn -q -DskipTests compile`
预期：编译通过，无报错。

---

### 任务 2: 前端日历视图 + 周报行 + 详情面板

**文件：**
- 修改：`frontend/src/pages/Reports.tsx`

**步骤 1: 定义月度汇总类型并接入查询**

```tsx
type MonthSummary = {
  dailyReports: Array<{ date: string; id: number; title: string }>
  weeklyReports: Array<{ weekNumber: number; id: number; startDate: string; endDate: string }>
}

const monthKey = format(selectedMonth, 'yyyy-MM')
const { data: monthSummary, isLoading: isMonthLoading } = useQuery<MonthSummary>({
  queryKey: ['report-month-summary', monthKey],
  queryFn: () => api.post('/report/month-summary', {
    year: selectedMonth.getFullYear(),
    month: selectedMonth.getMonth() + 1,
  }),
})
```

**步骤 2: 构建 7x6 日历网格与周报行数据**

```tsx
const monthStart = startOfMonth(selectedMonth)
const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
const calendarDays = Array.from({ length: 42 }, (_, index) => {
  const date = addDays(calendarStart, index)
  return {
    date,
    dateKey: format(date, 'yyyy-MM-dd'),
    isCurrentMonth: isSameMonth(date, selectedMonth),
  }
})

const weekRows = Array.from({ length: 6 }, (_, index) => {
  const weekStart = addDays(calendarStart, index * 7)
  const weekEnd = addDays(weekStart, 6)
  return {
    weekNumber: index + 1,
    weekStart,
    weekEnd,
  }
})
```

**步骤 3: 选择态与详情加载**

```tsx
const [selectedDate, setSelectedDate] = useState<Date | null>(null)
const [selectedWeek, setSelectedWeek] = useState<{
  weekNumber: number
  weekStart: Date
  weekEnd: Date
} | null>(null)
const [selectedReportId, setSelectedReportId] = useState<number | null>(null)

const { data: selectedReport, isLoading: isReportLoading } = useQuery<Report>({
  queryKey: ['report-detail', selectedReportId],
  queryFn: () => api.get(`/report/detail/${selectedReportId}`),
  enabled: selectedReportId !== null,
})
```

**步骤 4: 渲染日历格子、周报行与右侧面板**

```tsx
const dailyMap = new Map(monthSummary?.dailyReports.map(item => [item.date, item]))
const weeklyMap = new Map(monthSummary?.weeklyReports.map(item => [item.weekNumber, item]))

// 日历格子：
// - 绿色实心圆点：完成日报
// - 灰色空心圆点：未完成日报
// - 今天日期高亮
// - 非当月日期变淡
// - 点击切换详情面板

// 周报行：
// - 文案：周报 W{weekNumber}
// - 绿色圆点：完成周报
// - 灰色圆点：未完成周报
// - 点击显示周报详情/空状态
```

**步骤 5: 详情面板与生成/编辑/删除/复制交互**

```tsx
// 有报告：显示标题、内容、创建时间 + 复制/编辑/删除按钮
// 无报告：显示空状态 + “生成日报/周报”按钮
// 生成按钮：打开对话框并预填类型、日期范围
// 删除/编辑后：刷新月度汇总与详情数据
```

**步骤 6: 运行前端构建验证**

运行：`npm run build`
预期：构建通过，无类型错误。

---

### 任务 3: 手动验证关键交互

**文件：**
- 参考：`frontend/src/pages/Reports.tsx`

**步骤 1: 切换月份**
- 操作：点击左右切换按钮
- 预期：日历日期正确变化，统计数字随月份刷新

**步骤 2: 日报完成状态**
- 操作：查看有日报/无日报日期的圆点
- 预期：有日报为绿色实心圆点，未完成为灰色空心圆点

**步骤 3: 点击日报日期**
- 操作：点击有报告的日期
- 预期：右侧显示报告详情与操作按钮

**步骤 4: 点击空白日报日期**
- 操作：点击无报告的日期
- 预期：右侧显示“暂无日报”与生成按钮

**步骤 5: 点击周报行**
- 操作：点击周报 WN 行
- 预期：有周报显示详情，无周报显示空状态

**步骤 6: 生成报告**
- 操作：在空状态点击生成按钮
- 预期：生成成功后日历状态更新，右侧展示新报告
