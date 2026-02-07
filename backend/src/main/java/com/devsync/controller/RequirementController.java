package com.devsync.controller;

import com.alibaba.fastjson2.JSON;
import com.devsync.common.exception.BusinessException;
import com.devsync.common.result.Result;
import com.devsync.dto.req.RequirementAddReq;
import com.devsync.dto.req.RequirementDeleteReq;
import com.devsync.dto.req.RequirementLinkedReq;
import com.devsync.dto.req.RequirementLinkReq;
import com.devsync.dto.req.RequirementListReq;
import com.devsync.dto.req.RequirementStatusUpdateReq;
import com.devsync.dto.req.RequirementUpdateReq;
import com.devsync.dto.rsp.RequirementRsp;
import com.devsync.service.IRequirementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 需求管理控制器
 *
 * @author xiaolei
 */
@Slf4j
@RestController
@RequestMapping("/api/requirement")
@RequiredArgsConstructor
@Tag(name = "需求管理")
public class RequirementController {

    private final IRequirementService requirementService;

    @PostMapping("/list")
    @Operation(summary = "查询迭代需求列表")
    public Result<List<RequirementRsp>> list(@Valid @RequestBody RequirementListReq req) {
        try {
            return Result.success(requirementService.listRequirements(req));
        } catch (Exception e) {
            log.error("[需求管理] 列表查询失败，参数: {}", JSON.toJSONString(req), e);
            if (e instanceof BusinessException businessException) {
                return Result.error(businessException.getCode(), businessException.getMessage());
            }
            return Result.error("需求列表查询失败");
        }
    }

    @PostMapping("/add")
    @Operation(summary = "新增需求")
    public Result<Integer> add(@Valid @RequestBody RequirementAddReq req) {
        try {
            return Result.success(requirementService.addRequirement(req));
        } catch (Exception e) {
            log.error("[需求管理] 新增失败，参数: {}", JSON.toJSONString(req), e);
            if (e instanceof BusinessException businessException) {
                return Result.error(businessException.getCode(), businessException.getMessage());
            }
            return Result.error("需求新增失败");
        }
    }

    @PostMapping("/update")
    @Operation(summary = "更新需求")
    public Result<Void> update(@Valid @RequestBody RequirementUpdateReq req) {
        try {
            requirementService.updateRequirement(req);
            return Result.success();
        } catch (Exception e) {
            log.error("[需求管理] 更新失败，参数: {}", JSON.toJSONString(req), e);
            if (e instanceof BusinessException businessException) {
                return Result.error(businessException.getCode(), businessException.getMessage());
            }
            return Result.error("需求更新失败");
        }
    }

    @PostMapping("/delete")
    @Operation(summary = "删除需求")
    public Result<Void> delete(@Valid @RequestBody RequirementDeleteReq req) {
        try {
            requirementService.deleteRequirement(req);
            return Result.success();
        } catch (Exception e) {
            log.error("[需求管理] 删除失败，参数: {}", JSON.toJSONString(req), e);
            if (e instanceof BusinessException businessException) {
                return Result.error(businessException.getCode(), businessException.getMessage());
            }
            return Result.error("需求删除失败");
        }
    }

    @PostMapping("/link")
    @Operation(summary = "关联需求")
    public Result<Void> link(@Valid @RequestBody RequirementLinkReq req) {
        try {
            requirementService.linkRequirement(req);
            return Result.success();
        } catch (Exception e) {
            log.error("[需求管理] 关联失败，参数: {}", JSON.toJSONString(req), e);
            if (e instanceof BusinessException businessException) {
                return Result.error(businessException.getCode(), businessException.getMessage());
            }
            return Result.error("需求关联失败");
        }
    }

    @PostMapping("/status")
    @Operation(summary = "更新需求状态")
    public Result<Void> status(@Valid @RequestBody RequirementStatusUpdateReq req) {
        try {
            requirementService.updateStatus(req);
            return Result.success();
        } catch (Exception e) {
            log.error("[需求管理] 状态更新失败，参数: {}", JSON.toJSONString(req), e);
            if (e instanceof BusinessException businessException) {
                return Result.error(businessException.getCode(), businessException.getMessage());
            }
            return Result.error("需求状态更新失败");
        }
    }

    @PostMapping("/linked")
    @Operation(summary = "查询已关联的需求", description = "根据关联类型和关联ID查询已关联的需求，如查询某个SQL已关联的需求")
    public Result<RequirementRsp> linked(@Valid @RequestBody RequirementLinkedReq req) {
        try {
            RequirementRsp rsp = requirementService.getLinkedRequirement(req.getLinkType(), req.getLinkId());
            return Result.success(rsp);
        } catch (Exception e) {
            log.error("[需求管理] 查询已关联需求失败，参数: {}", JSON.toJSONString(req), e);
            if (e instanceof BusinessException businessException) {
                return Result.error(businessException.getCode(), businessException.getMessage());
            }
            return Result.error("查询已关联需求失败");
        }
    }
}
