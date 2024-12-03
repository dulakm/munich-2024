import * as gcp from "@pulumi/gcp";
import type {Input} from "@pulumi/pulumi";
import * as pulumi from "@pulumi/pulumi";
import {Output} from "@pulumi/pulumi";
import * as random from "@pulumi/random";

const project = new pulumi.Config("gcp").require("project");
const teamMembers: string[] = new pulumi.Config().requireObject("teamMembers");

export const generateAndSavePassword = (name: string): Output<string> => {
    const password = new random.RandomPassword(name, {
        length: 16,
    });

    return savePassword(name, password.result);
};

export const savePassword = (name: string, password: Input<string>): Output<string> => saveSecret(`${name}-password`, password);

export const saveSecret = (name: string, textSecret: Input<string>): Output<string> => {
    const secret = new gcp.secretmanager.Secret(name, {
        secretId: name,
        replication: {
            automatic: true,
        },
    });

    new gcp.secretmanager.SecretVersion(name, {
        secret: secret.id,
        secretData: textSecret,
    });

    return Output.create(textSecret);
};

["roles/secretmanager.viewer", "roles/secretmanager.secretAccessor"].forEach((role) => {
    new gcp.projects.IAMBinding(`team-access-to-secret-manager/${role}`, {
        project,
        role,
        members: teamMembers.map((user) => `user:${user}`),
    });
});
