package com.devsync.service.impl;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.devsync.common.enums.RequirementStatusEnum;
import com.devsync.common.exception.BusinessException;
import com.devsync.dto.req.RequirementAddReq;
import com.devsync.dto.req.RequirementDeleteReq;
import com.devsync.dto.req.RequirementLinkReq;
import com.devsync.dto.req.RequirementListReq;
import com.devsync.dto.req.RequirementStatusUpdateReq;
import com.devsync.dto.req.RequirementUpdateReq;
import com.devsync.dto.rsp.RequirementRsp;
import com.devsync.entity.Iteration;
import com.devsync.entity.Project;
import com.devsync.entity.Requirement;
import com.devsync.entity.RequirementProject;
import com.devsync.entity.WorkItemLink;
import com.devsync.mapper.IterationMapper;
import com.devsync.mapper.ProjectMapper;
import com.devsync.mapper.RequirementMapper;
import com.devsync.mapper.RequirementProjectMapper;
import com.devsync.mapper.WorkItemLinkMapper;
import com.devsync.service.IRequirementService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 需求服务实现
 *
 * @author xiaolei
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RequirementServiceImpl extends ServiceImpl<RequirementMapper, Requirement> implements IRequirementService {

    private static final Set<String> SUPPORTED_LINK_TYPES = Set.of("sql", "commit");

    private final RequirementMapper requirementMapper;
    private final RequirementProjectMapper requirementProjectMapper;
    private final ProjectMapper projectMapper;
    private final IterationMapper iterationMapper;
    private final WorkItemLinkMapper workItemLinkMapper;

    @Override
    public List<RequirementRsp> listRequirements(RequirementListReq req) {
        log.info("[需求管理] 查询需求列表，iterationId={}, keyword={}", req.getIterationId(), req.getKeyword());

        LambdaQueryWrapper<Requirement> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Requirement::getIterationId, req.getIterationId())
                .like(StrUtil.isNotBlank(req.getKeyword()), Requirement::getName, req.getKeyword())
                .orderByDesc(Requirement::getCreatedAt);

        List<Requirement> requirements = requirementMapper.selectList(wrapper);
        if (requirements.isEmpty()) {
            return List.of();
        }

        List<Integer> requirementIds = requirements.stream()
                .map(Requirement::getId)
                .filter(Objects::nonNull)
                .toList();

        Map<Integer, List<Integer>> requirementProjects = loadRequirementProjects(requirementIds);
        Map<Integer, String> projectNameMap = loadProjectNames(requirementProjects);
        Map<Integer, Integer> sqlCounts = buildLinkCountMap(requirementIds, "sql");
        Map<Integer, Integer> commitCounts = buildLinkCountMap(requirementIds, "commit");

        return requirements.stream().map(requirement -> {
            RequirementRsp rsp = new RequirementRsp();
            BeanUtil.copyProperties(requirement, rsp);

            RequirementStatusEnum statusEnum = RequirementStatusEnum.getByCode(requirement.getStatus());
            if (statusEnum != null) {
                rsp.setStatusDesc(statusEnum.getDesc());
            }

            List<Integer> projectIds = requirementProjects.getOrDefault(requirement.getId(), List.of());
            List<Integer> uniqueProjectIds = projectIds.stream().distinct().toList();
            rsp.setProjectIds(uniqueProjectIds);

            List<String> projectNames = uniqueProjectIds.stream()
                    .map(id -> projectNameMap.getOrDefault(id, "未知项目"))
                    .toList();
            rsp.setProjectNames(projectNames);

            rsp.setLinkedSqlCount(sqlCounts.getOrDefault(requirement.getId(), 0));
            rsp.setLinkedCommitCount(commitCounts.getOrDefault(requirement.getId(), 0));

            return rsp;
        }).collect(Collectors.toList());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Integer addRequirement(RequirementAddReq req) {
        log.info("[需求管理] 新增需求，iterationId={}, name={}", req.getIterationId(), req.getName());

        Iteration iteration = iterationMapper.selectById(req.getIterationId());
        if (iteration == null) {
            throw new BusinessException(404, "迭代不存在");
        }

        Requirement requirement = new Requirement();
        requirement.setIterationId(req.getIterationId());
        requirement.setName(req.getName());
        requirement.setLink(StrUtil.blankToDefault(req.getLink(), ""));
        requirement.setBranch(StrUtil.blankToDefault(req.getBranch(), ""));

        String status = StrUtil.blankToDefault(req.getStatus(), RequirementStatusEnum.PRESENTED.getCode());
        RequirementStatusEnum statusEnum = RequirementStatusEnum.getByCode(status);
        if (statusEnum == null) {
            throw new BusinessException(400, "无效的需求状态");
        }
        requirement.setStatus(statusEnum.getCode());

        requirementMapper.insert(requirement);
        syncProjects(requirement.getId(), req.getProjectIds());

        return requirement.getId();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateRequirement(RequirementUpdateReq req) {
        log.info("[需求管理] 更新需求，id={}", req.getId());

        Requirement requirement = requirementMapper.selectById(req.getId());
        if (requirement == null) {
            throw new BusinessException(404, "需求不存在");
        }

        requirement.setName(req.getName());
        requirement.setLink(StrUtil.blankToDefault(req.getLink(), ""));
        requirement.setBranch(StrUtil.blankToDefault(req.getBranch(), ""));

        if (StrUtil.isNotBlank(req.getStatus())) {
            RequirementStatusEnum targetStatus = RequirementStatusEnum.getByCode(req.getStatus());
            if (targetStatus == null) {
                throw new BusinessException(400, "无效的需求状态");
            }

            String currentStatus = StrUtil.blankToDefault(requirement.getStatus(), RequirementStatusEnum.PRESENTED.getCode());
            if (!RequirementStatusEnum.canTransfer(currentStatus, targetStatus.getCode())) {
                throw new BusinessException(400, "需求状态流转不合法");
            }

            requirement.setStatus(targetStatus.getCode());
        }
        requirementMapper.updateById(requirement);

        syncProjects(req.getId(), req.getProjectIds());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateStatus(RequirementStatusUpdateReq req) {
        log.info("[需求管理] 更新需求状态，id={}, status={}", req.getId(), req.getStatus());

        Requirement requirement = requirementMapper.selectById(req.getId());
        if (requirement == null) {
            throw new BusinessException(404, "需求不存在");
        }

        RequirementStatusEnum targetStatus = RequirementStatusEnum.getByCode(req.getStatus());
        if (targetStatus == null) {
            throw new BusinessException(400, "无效的需求状态");
        }

        String currentStatus = StrUtil.blankToDefault(requirement.getStatus(), RequirementStatusEnum.PRESENTED.getCode());
        if (!RequirementStatusEnum.canTransfer(currentStatus, targetStatus.getCode())) {
            throw new BusinessException(400, "需求状态流转不合法");
        }

        requirement.setStatus(targetStatus.getCode());
        requirementMapper.updateById(requirement);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteRequirement(RequirementDeleteReq req) {
        log.info("[需求管理] 删除需求，id={}", req.getId());

        Requirement requirement = requirementMapper.selectById(req.getId());
        if (requirement == null) {
            throw new BusinessException(404, "需求不存在");
        }

        requirementMapper.deleteById(req.getId());
        requirementProjectMapper.deleteByRequirementId(req.getId());
        workItemLinkMapper.deleteByWorkItemId(req.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void linkRequirement(RequirementLinkReq req) {
        log.info("[需求管理] 关联需求，requirementId={}, linkType={}, linkId={}",
                req.getRequirementId(), req.getLinkType(), req.getLinkId());

        Requirement requirement = requirementMapper.selectById(req.getRequirementId());
        if (requirement == null) {
            throw new BusinessException(404, "需求不存在");
        }

        String linkType = req.getLinkType().toLowerCase(java.util.Locale.ROOT);
        if (!SUPPORTED_LINK_TYPES.contains(linkType)) {
            throw new BusinessException(400, "无效的关联类型");
        }

        LambdaQueryWrapper<WorkItemLink> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(WorkItemLink::getWorkItemId, req.getRequirementId())
                .eq(WorkItemLink::getLinkType, linkType)
                .eq(WorkItemLink::getLinkId, req.getLinkId());

        if (workItemLinkMapper.selectCount(wrapper) > 0) {
            return;
        }

        // 兼容：如果存在已软删除记录，则优先恢复，避免唯一约束冲突
        WorkItemLink deletedLink = workItemLinkMapper.selectOneIncludingDeleted(
                req.getRequirementId(),
                linkType,
                req.getLinkId()
        );
        if (deletedLink != null && deletedLink.getDeletedAt() != null) {
            workItemLinkMapper.restoreById(deletedLink.getId());
            return;
        }

        WorkItemLink link = new WorkItemLink();
        link.setWorkItemId(req.getRequirementId());
        link.setLinkType(linkType);
        link.setLinkId(req.getLinkId());
        workItemLinkMapper.insert(link);
    }

    private void syncProjects(Integer requirementId, List<Integer> projectIds) {
        requirementProjectMapper.deleteByRequirementId(requirementId);
        if (projectIds == null || projectIds.isEmpty()) {
            return;
        }

        List<Integer> distinctProjectIds = projectIds.stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        for (Integer projectId : distinctProjectIds) {
            RequirementProject relation = new RequirementProject();
            relation.setRequirementId(requirementId);
            relation.setProjectId(projectId);
            requirementProjectMapper.insert(relation);
        }
    }

    private Map<Integer, List<Integer>> loadRequirementProjects(List<Integer> requirementIds) {
        if (requirementIds.isEmpty()) {
            return Map.of();
        }

        LambdaQueryWrapper<RequirementProject> wrapper = new LambdaQueryWrapper<>();
        wrapper.in(RequirementProject::getRequirementId, requirementIds);
        List<RequirementProject> relations = requirementProjectMapper.selectList(wrapper);

        return relations.stream().collect(Collectors.groupingBy(
                RequirementProject::getRequirementId,
                Collectors.mapping(RequirementProject::getProjectId, Collectors.toList())
        ));
    }

    private Map<Integer, String> loadProjectNames(Map<Integer, List<Integer>> requirementProjects) {
        Set<Integer> projectIds = new HashSet<>();
        for (List<Integer> ids : requirementProjects.values()) {
            projectIds.addAll(ids);
        }

        if (projectIds.isEmpty()) {
            return Map.of();
        }

        List<Project> projects = projectMapper.selectBatchIds(projectIds);
        Map<Integer, String> projectNameMap = new HashMap<>();
        for (Project project : projects) {
            projectNameMap.put(project.getId(), project.getName());
        }

        return projectNameMap;
    }

    private Map<Integer, Integer> buildLinkCountMap(List<Integer> requirementIds, String linkType) {
        if (requirementIds.isEmpty()) {
            return Map.of();
        }

        LambdaQueryWrapper<WorkItemLink> wrapper = new LambdaQueryWrapper<>();
        wrapper.in(WorkItemLink::getWorkItemId, requirementIds)
                .eq(WorkItemLink::getLinkType, linkType);

        List<WorkItemLink> links = workItemLinkMapper.selectList(wrapper);
        if (links.isEmpty()) {
            return Map.of();
        }

        Map<Integer, Integer> result = new HashMap<>();
        Map<Integer, Long> countMap = links.stream()
                .collect(Collectors.groupingBy(WorkItemLink::getWorkItemId, Collectors.counting()));

        for (Map.Entry<Integer, Long> entry : countMap.entrySet()) {
            result.put(entry.getKey(), entry.getValue().intValue());
        }

        return result;
    }
}
