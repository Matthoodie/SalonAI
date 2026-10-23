import {
  createSalonInvitation,
  revokeSalonInvitation,
  listSalonInvitations,
  listInvitationEligibleEmployees,
} from '../services/invitationManagementService.js'

import {
  acceptSalonInvitation,
} from '../services/invitationAcceptanceService.js'

export function createInvitationController({
  acceptInvitation = acceptSalonInvitation,
} = {}) {
  return {
    async eligibleEmployees(req, res, next) {
      try {
        const employees = await listInvitationEligibleEmployees({
          salonId: req.currentSalon?.id,
          actorUserId: req.currentUser?.id,
        })

        return res.status(200).json({
          data: {
            employees,
          },
        })
      } catch (error) {
        return next(error)
      }
    },

    async list(req, res, next) {
      try {
        const result = await listSalonInvitations({
          salonId: req.currentSalon?.id,
          actorUserId: req.currentUser?.id,
          beforeId: req.query?.before_id,
        })

        return res.status(200).json({
          data: result,
        })
      } catch (error) {
        return next(error)
      }
    },

    async create(req, res, next) {
      try {
        const result = await createSalonInvitation({
          salonId: req.currentSalon?.id,
          actorUserId: req.currentUser?.id,
          email: req.body?.email,
          role: req.body?.role,
          employeeId: req.body?.employee_id ?? null,
        })

        return res.status(201).json({
          data: result,
        })
      } catch (error) {
        return next(error)
      }
    },

    async revoke(req, res, next) {
      try {
        const invitation = await revokeSalonInvitation({
          salonId: req.currentSalon?.id,
          actorUserId: req.currentUser?.id,
          invitationId: req.params.id,
        })

        return res.status(200).json({
          data: {
            invitation,
          },
        })
      } catch (error) {
        return next(error)
      }
    },

    async accept(req, res, next) {
      try {
        const result = await acceptInvitation({
          currentUserId: req.currentUser?.id,
          token: req.body?.token,
        })

        return res.status(200).json({
          data: result,
        })
      } catch (error) {
        return next(error)
      }
    },
  }
}
