import { endpoints } from "../constants/discord.ts";
import { RequestManager } from "../module/requestManager.ts";
import { Errors } from "../types/errors.ts";
import { Permissions } from "../types/permission.ts";
import { botHasChannelPermissions } from "../utils/permissions.ts";
import { structures } from "../structures/mod.ts";
export function channelOverwriteHasPermission(guildID, id, overwrites, permissions) {
    const overwrite = overwrites.find((perm) => perm.id === id) ||
        overwrites.find((perm) => perm.id === guildID);
    return permissions.every((perm) => {
        if (overwrite) {
            if (BigInt(overwrite.deny) & BigInt(perm))
                return false;
            if (BigInt(overwrite.allow) & BigInt(perm))
                return true;
        }
        return false;
    });
}
export async function getMessage(channelID, id) {
    if (!botHasChannelPermissions(channelID, [Permissions.VIEW_CHANNEL])) {
        throw new Error(Errors.MISSING_VIEW_CHANNEL);
    }
    if (!botHasChannelPermissions(channelID, [Permissions.READ_MESSAGE_HISTORY])) {
        throw new Error(Errors.MISSING_READ_MESSAGE_HISTORY);
    }
    const result = await RequestManager.get(endpoints.CHANNEL_MESSAGE(channelID, id));
    return structures.createMessage(result);
}
export async function getMessages(channelID, options) {
    if (!botHasChannelPermissions(channelID, [Permissions.VIEW_CHANNEL])) {
        throw new Error(Errors.MISSING_VIEW_CHANNEL);
    }
    if (!botHasChannelPermissions(channelID, [Permissions.READ_MESSAGE_HISTORY])) {
        throw new Error(Errors.MISSING_READ_MESSAGE_HISTORY);
    }
    if (options?.limit && options.limit > 100)
        return;
    const result = (await RequestManager.get(endpoints.CHANNEL_MESSAGES(channelID), options));
    return Promise.all(result.map((res) => structures.createMessage(res)));
}
export async function getPins(channelID) {
    const result = (await RequestManager.get(endpoints.CHANNEL_PINS(channelID)));
    return Promise.all(result.map((res) => structures.createMessage(res)));
}
export async function sendMessage(channelID, content) {
    if (typeof content === "string")
        content = { content };
    if (!botHasChannelPermissions(channelID, [Permissions.SEND_MESSAGES])) {
        throw new Error(Errors.MISSING_SEND_MESSAGES);
    }
    if (content.tts &&
        !botHasChannelPermissions(channelID, [Permissions.SEND_TTS_MESSAGES])) {
        throw new Error(Errors.MISSING_SEND_TTS_MESSAGE);
    }
    if (content.embed &&
        !botHasChannelPermissions(channelID, [Permissions.EMBED_LINKS])) {
        throw new Error(Errors.MISSING_EMBED_LINKS);
    }
    if (content.content && [...content.content].length > 2000) {
        throw new Error(Errors.MESSAGE_MAX_LENGTH);
    }
    if (content.mentions) {
        if (content.mentions.users?.length) {
            if (content.mentions.parse?.includes("users")) {
                content.mentions.parse = content.mentions.parse.filter((p) => p !== "users");
            }
            if (content.mentions.users.length > 100) {
                content.mentions.users = content.mentions.users.slice(0, 100);
            }
        }
        if (content.mentions.roles?.length) {
            if (content.mentions.parse?.includes("roles")) {
                content.mentions.parse = content.mentions.parse.filter((p) => p !== "roles");
            }
            if (content.mentions.roles.length > 100) {
                content.mentions.roles = content.mentions.roles.slice(0, 100);
            }
        }
    }
    const result = await RequestManager.post(endpoints.CHANNEL_MESSAGES(channelID), {
        ...content,
        allowed_mentions: content.mentions,
    });
    return structures.createMessage(result);
}
export function deleteMessages(channelID, ids, reason) {
    if (!botHasChannelPermissions(channelID, [Permissions.MANAGE_MESSAGES])) {
        throw new Error(Errors.MISSING_MANAGE_MESSAGES);
    }
    if (ids.length < 2) {
        throw new Error(Errors.DELETE_MESSAGES_MIN);
    }
    if (ids.length > 100) {
        console.warn(`This endpoint only accepts a maximum of 100 messages. Deleting the first 100 message ids provided.`);
    }
    return RequestManager.post(endpoints.CHANNEL_BULK_DELETE(channelID), {
        messages: ids.splice(0, 100),
        reason,
    });
}
export function getChannelInvites(channelID) {
    if (!botHasChannelPermissions(channelID, [Permissions.MANAGE_CHANNELS])) {
        throw new Error(Errors.MISSING_MANAGE_CHANNELS);
    }
    return RequestManager.get(endpoints.CHANNEL_INVITES(channelID));
}
export function createInvite(channelID, options) {
    if (!botHasChannelPermissions(channelID, [Permissions.CREATE_INSTANT_INVITE])) {
        throw new Error(Errors.MISSING_CREATE_INSTANT_INVITE);
    }
    return RequestManager.post(endpoints.CHANNEL_INVITES(channelID), options);
}
export function getChannelWebhooks(channelID) {
    if (!botHasChannelPermissions(channelID, [Permissions.MANAGE_WEBHOOKS])) {
        throw new Error(Errors.MISSING_MANAGE_WEBHOOKS);
    }
    return RequestManager.get(endpoints.CHANNEL_WEBHOOKS(channelID));
}
const editChannelNameTopicQueue = new Map();
let editChannelProcessing = false;
function processEditChannelQueue() {
    if (!editChannelProcessing)
        return;
    const now = Date.now();
    editChannelNameTopicQueue.forEach((request) => {
        if (now > request.timestamp)
            return;
        if (!request.items.length) {
            return editChannelNameTopicQueue.delete(request.channelID);
        }
        request.amount = 0;
        const details = request.items.shift();
        if (!details)
            return;
        editChannel(details.channelID, details.options);
        const secondDetails = request.items.shift();
        if (!secondDetails)
            return;
        return editChannel(secondDetails.channelID, secondDetails.options);
    });
    if (editChannelNameTopicQueue.size) {
        setTimeout(() => processEditChannelQueue(), 600000);
    }
    else {
        editChannelProcessing = false;
    }
}
export function editChannel(channelID, options) {
    if (!botHasChannelPermissions(channelID, [Permissions.MANAGE_CHANNELS])) {
        throw new Error(Errors.MISSING_MANAGE_CHANNELS);
    }
    if (options.name || options.topic) {
        const request = editChannelNameTopicQueue.get(channelID);
        if (!request) {
            editChannelNameTopicQueue.set(channelID, {
                channelID: channelID,
                amount: 1,
                timestamp: Date.now() + 600000,
                items: [],
            });
        }
        else if (request.amount === 1) {
            request.amount = 2;
            request.timestamp = Date.now() + 600000;
        }
        else {
            request.items.push({ channelID, options });
            if (editChannelProcessing)
                return;
            editChannelProcessing = true;
            processEditChannelQueue();
            return;
        }
    }
    const payload = {
        ...options,
        rate_limit_per_user: options.slowmode,
        parent_id: options.parentID,
        user_limit: options.userLimit,
        permission_overwrites: options.overwrites?.map((overwrite) => {
            return {
                ...overwrite,
                allow: overwrite.allow.reduce((bits, perm) => bits |= BigInt(Permissions[perm]), BigInt(0)).toString(),
                deny: overwrite.deny.reduce((bits, perm) => bits |= BigInt(Permissions[perm]), BigInt(0)).toString(),
            };
        }),
    };
    return RequestManager.patch(endpoints.GUILD_CHANNEL(channelID), payload);
}
export async function followChannel(sourceChannelID, targetChannelID) {
    if (!botHasChannelPermissions(targetChannelID, [Permissions.MANAGE_WEBHOOKS])) {
        throw new Error(Errors.MISSING_MANAGE_CHANNELS);
    }
    const data = await RequestManager.post(endpoints.CHANNEL_FOLLOW(sourceChannelID), {
        webhook_channel_id: targetChannelID,
    });
    return data.webhook_id;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhbm5lbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNoYW5uZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBYUEsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQ3BELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUM3RCxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDNUMsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3JELE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQ25FLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUdsRCxNQUFNLFVBQVUsNkJBQTZCLENBQzNDLE9BQWUsRUFDZixFQUFVLEVBQ1YsVUFBMEIsRUFDMUIsV0FBMEI7SUFFMUIsTUFBTSxTQUFTLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUM7UUFDekQsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxPQUFPLENBQUMsQ0FBQztJQUVqRCxPQUFPLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtRQUNoQyxJQUFJLFNBQVMsRUFBRTtZQUNiLElBQUksTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDO2dCQUFFLE9BQU8sS0FBSyxDQUFDO1lBQ3hELElBQUksTUFBTSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDO2dCQUFFLE9BQU8sSUFBSSxDQUFDO1NBQ3pEO1FBQ0QsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDLENBQUMsQ0FBQztBQUNM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