module 0x0::subscription;

use std::string::String;
use sui::{clock::Clock, coin::Coin, dynamic_field as df, sui::SUI};
use 0x0::utils::is_prefix;

const EInvalidCap: u64 = 0;
const EInvalidFee: u64 = 1;
const ENoAccess: u64 = 2;
const MARKER: u64 = 3;

public struct Service has key {
    id: UID,
    fee: u64,
    ttl: u64,
    owner: address,
    name: String,
}

public struct Subscription has key {
    id: UID,
    service_id: ID,
    created_at: u64,
}

public struct Cap has key {
    id: UID,
    service_id: ID,
}

public fun create_service(fee: u64, ttl: u64, name: String, ctx: &mut TxContext): Cap {
    let service = Service {
        id: object::new(ctx),
        fee: fee,
        ttl: ttl,
        owner: ctx.sender(),
        name: name,
    };
    let cap = Cap {
        id: object::new(ctx),
        service_id: object::id(&service),
    };
    transfer::share_object(service);
    cap
}

entry fun create_service_entry(fee: u64, ttl: u64, name: String, ctx: &mut TxContext) {
    transfer::transfer(create_service(fee, ttl, name, ctx), ctx.sender());
}

public fun subscribe(
    fee: Coin<SUI>,
    service: &Service,
    c: &Clock,
    ctx: &mut TxContext,
): Subscription {
    assert!(fee.value() == service.fee, EInvalidFee);
    transfer::public_transfer(fee, service.owner);
    Subscription {
        id: object::new(ctx),
        service_id: object::id(service),
        created_at: c.timestamp_ms(),
    }
}

public fun transfer(sub: Subscription, to: address) {
    transfer::transfer(sub, to);
}

fun approve_internal(id: vector<u8>, sub: &Subscription, service: &Service, c: &Clock): bool {
    if (object::id(service) != sub.service_id) {
        return false
    };
    if (c.timestamp_ms() > sub.created_at + service.ttl) {
        return false
    };

    // Check if the id has the right prefix
    is_prefix(service.id.to_bytes(), id)
}

entry fun seal_approve(id: vector<u8>, sub: &Subscription, service: &Service, c: &Clock) {
    assert!(approve_internal(id, sub, service, c), ENoAccess);
}

/// Encapsulate a blob into a Sui object and attach it to the Subscription
public fun publish(service: &mut Service, cap: &Cap, blob_id: String) {
    assert!(cap.service_id == object::id(service), EInvalidCap);
    df::add(&mut service.id, blob_id, MARKER);
}